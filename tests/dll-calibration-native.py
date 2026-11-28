"""Native PSSC comparison. Windows x64 Python + Node; no hardware or NVM access.
Usage: py -3 tests/dll-calibration-native.py --dll PATH --dll PATH --out dll-comparison.json
The DLLs must be original local files from the SSC library, not copied to this repo.
"""
import argparse
import ctypes as ct
import hashlib
import json
import math
import os
from pathlib import Path
import subprocess
import sys

class FitInfo(ct.Structure):
    _fields_ = [(x, ct.c_double) for x in
                ('err_max','err_rms','used_adc_t_range','used_adc_s_range','used_adc_ts_area','sample_density')]

Cfg = ct.c_uint16 * 65
D = ct.POINTER(ct.c_double)
CP = ct.POINTER(Cfg)
FP = ct.POINTER(FitInfo)

def crc(bits, poly, init, data):
    value = init
    for byte in data:
        for shift in range(7, -1, -1):
            mix = ((value >> (bits-1)) & 1) ^ ((byte >> shift) & 1)
            value = ((value << 1) ^ (poly if mix else 0)) & ((1 << bits)-1)
    return value

def update_crc(w):
    raw = lambda seq: bytes(v for n in seq for v in (n >> 8, n & 255))
    w[15] = (crc(8, 7, 255, raw(w[:15]) + bytes([w[15]&255])) << 8) | (w[15]&255)
    w[63] = crc(16, 0x8005, 0xffff, raw(w[:63]))

def config(case):
    # Synthetic DS 25DS0170E.04 memory map. Not an actual chip NVM dump.
    f = case['factory']; w = [0]*65
    for i,v in {11:f['g01'],12:f['g2off'],16:f['cfgEn'],17:0x6c06,18:0x4000,
                19:0x099f,20:0x100f,21:1,22:0x0880,24:0x48a0,25:0x2e56,
                26:0x04b4,27:0x0c80,28:0x0800,29:f['afe2'],32:0x1000,
                51:0x0f4d,52:0xbc8e,53:0xfc54,64:0x0020}.items(): w[i]=v
    update_crc(w)
    return w

def finite(v):
    return v if math.isfinite(v) else None

def stats(errors):
    if not errors or any(not math.isfinite(x) for x in errors): return None
    return {'max_abs':max(map(abs,errors)), 'rms':math.sqrt(sum(x*x for x in errors)/len(errors)),
            'mean':sum(errors)/len(errors), 'count':len(errors)}

def vals(points,key):
    return (ct.c_double*len(points))(*(p[key] for p in points))

def fit_dict(x):
    return {key:finite(getattr(x,key)) for key,_ in x._fields_}

def run_dll(path, matrix):
    path=path.resolve()
    with os.add_dll_directory(str(path.parent)):
        dll=ct.WinDLL(str(path))
        cal=dll.pssc_cal_calibration
        cal.argtypes=[CP,ct.c_int,ct.c_int,ct.c_int,D,D,D,D,D,FP,D,FP,D]
        cal.restype=ct.c_int
        sim=dll.pssc_cal_simulation
        sim.argtypes=[CP,ct.c_int,D,D,D,D,D]; sim.restype=ct.c_int
        version=dll.pssc_cal_lib_version_int
        version.argtypes=[]; version.restype=ct.c_int
        def simulate(w,points):
            if not points: return {'rc':0,'s':[],'t':[]}
            c=Cfg(*w); n=len(points); s=(ct.c_double*n)(); t=(ct.c_double*n)()
            rc=sim(ct.byref(c),n,vals(points,'adc_t'),vals(points,'adc_tc'),vals(points,'adc_s'),t,s)
            return {'rc':rc,'s':[finite(x) for x in s] if rc==0 else [],'t':[finite(x) for x in t] if rc==0 else []}
        def metrics(a,b,points,use_t):
            if a['rc'] or b['rc']: return None
            out={}
            for axis in ('s','t') if use_t else ('s',):
                if any(x is None for x in a[axis]+b[axis]): return None
                out[axis]=stats([x-y for x,y in zip(a[axis],b[axis])])
            return out
        results=[]
        for case in matrix['cases']:
            w=config(case); c=Cfg(*w); pts=case['points']; n=len(pts)
            ti=FitInfo(); si=FitInfo(); te=(ct.c_double*n)(); se=(ct.c_double*n)()
            rc=cal(ct.byref(c),case['opts']['orderT'],case['sMask'],n,
                   vals(pts,'adc_t'),vals(pts,'adc_tc'),vals(pts,'adc_s'),
                   vals(pts,'targetT'),vals(pts,'targetS'),ct.byref(ti),te,ct.byref(si),se)
            native=list(c)
            row={'name':case['name'],'source':case['source'],'options':case['opts'],
                 'sMask':case['sMask'],'initial_cfg':w,'points':pts,'verification_points':case['verify'],
                 'native_rc':rc,'native_cfg':native,'native_fit_T':fit_dict(ti),
                 'native_fit_S':fit_dict(si),'native_point_errors_T':[finite(x) for x in te],
                 'native_point_errors_S':[finite(x) for x in se],'js':case['js'],
                 'uiPointLimitExceeded':case['uiPointLimitExceeded'],
                 'uiTemperatureOrderUnsupported':case['uiTemperatureOrderUnsupported']}
            use_t=case['opts']['orderT']>0
            if rc==0:
                row['native_fit_sim']=simulate(native,pts);row['native_verify_sim']=simulate(native,case['verify'])
            if case['js']['ok']:
                js=w[:]
                for i,v in case['js']['words'].items(): js[int(i)]=v
                update_crc(js);row['js_cfg']=js
                row['js_fit_native_sim']=simulate(js,pts);row['js_verify_native_sim']=simulate(js,case['verify'])
                if rc==0:
                    row['coefficient_diffs']=[{'index':i,'address':hex(2*i),'native':native[i],'js':js[i]}
                                              for i in matrix['coefficientIndices'] if native[i]!=js[i]
                                              and (use_t or i not in (31,32,51,52,53,54))]
                    row['fit_delta']=metrics(row['js_fit_native_sim'],row['native_fit_sim'],pts,use_t)
                    row['verify_delta']=metrics(row['js_verify_native_sim'],row['native_verify_sim'],case['verify'],use_t)
                    for label,pp,sim_key in [('fit',pts,'fit'),('verify',case['verify'],'verify')]:
                        target={'rc':0,'s':[p['targetS'] for p in pp],'t':[p['targetT'] for p in pp]}
                        row[label+'_native_target_error']=metrics(row['native_'+sim_key+'_sim'],target,pp,use_t)
                        row[label+'_js_target_error']=metrics(row['js_'+sim_key+'_native_sim'],target,pp,use_t)
            row['acceptance_agrees']=(rc==0)==case['js']['ok']
            # No arbitrary tolerance may silently mark equivalence.
            results.append(row)
        return {'file':str(path),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
                'version_int':version(),'cases':results,
                'summary':{'total':len(results),'native_success':sum(x['native_rc']==0 for x in results),
                           'js_success':sum(x['js']['ok'] for x in results),
                           'acceptance_disagreements':sum(not x['acceptance_agrees'] for x in results),
                           'coefficient_identity_on_joint_success':sum('coefficient_diffs' in x and not x['coefficient_diffs'] for x in results)}}

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--dll',action='append',type=Path,required=True)
    p.add_argument('--out',type=Path,default=Path('dll-comparison.json'))
    args=p.parse_args()
    if sys.platform!='win32' or ct.sizeof(ct.c_void_p)!=8:
        p.error('Windows x64 Python required; use the original 64-bit DLL.')
    root=Path(__file__).resolve().parent
    matrix=json.loads(subprocess.check_output(['node',str(root/'dll-calibration-matrix.cjs')],cwd=root.parent,text=True,encoding='utf-8'))
    report={'schema':1,'matrix':str(root/'dll-calibration-matrix.cjs'),
            'source_hashes':{n:hashlib.sha256((root.parent/n).read_bytes()).hexdigest() for n in ['calibration.js','temperature-afe.js','tests/dll-calibration-matrix.cjs']},'runs':[]}
    for path in args.dll:
        report['runs'].append(run_dll(path,matrix))
        print(json.dumps(report['runs'][-1]['summary']))
        args.out.write_text(json.dumps(report,indent=2,allow_nan=False),encoding='utf-8')
    print('Report:',args.out.resolve())
if __name__=='__main__': main()
