#!/usr/bin/env node
import {resolve} from 'node:path';
import {createEncryptedBackup,verifyEncryptedBackup,restoreEncryptedBackup} from '../backup.mjs';

const command=process.argv[2];
const args=Object.fromEntries(process.argv.slice(3).flatMap((x,i,all)=>
 x.startsWith('--')&&all[i+1]&&!all[i+1].startsWith('--')?[[x.slice(2),all[i+1]]]:[]
));
const secret=process.env.HISTORIA_BACKUP_PASSPHRASE;
try{
 let outcome;
 if(command==='create'&&args['data-dir']&&args.out)
  outcome=await createEncryptedBackup({directory:resolve(args['data-dir']),output:resolve(args.out),passphrase:secret});
 else if(command==='verify'&&args.input)
  outcome=await verifyEncryptedBackup({input:resolve(args.input),passphrase:secret});
 else if(command==='restore'&&args.input&&args['data-dir'])
  outcome=await restoreEncryptedBackup({input:resolve(args.input),directory:resolve(args['data-dir']),passphrase:secret});
 else throw Error('Uso: create --data-dir /data/historia --out /secure/backup.hbk | verify --input backup.hbk | restore --input backup.hbk --data-dir /empty/restore');
 // Never print the private archive contents, passphrase or account records.
 process.stdout.write(JSON.stringify({operation:command,...outcome})+'\n');
}catch(e){
 process.stderr.write(String(e.message||e)+'\n');
 process.exitCode=1;
}
