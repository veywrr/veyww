const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
fs.mkdirSync(path.join(root,'web/vendor'),{recursive:true});
fs.writeFileSync(path.join(root,'web/build.json'),JSON.stringify({version:require('../package.json').version,revision:process.env.GITHUB_SHA||'development',builtAt:new Date().toISOString()}));
let pkg;try{pkg=path.dirname(require.resolve('@soundtouchjs/audio-worklet/package.json'));}catch{pkg=path.join(root,'node_modules/.pnpm/@soundtouchjs+audio-worklet@2.1.1/node_modules/@soundtouchjs/audio-worklet');}
fs.cpSync(path.join(pkg,'.dist'),path.join(root,'web/vendor'),{recursive:true});
const hls=path.dirname(require.resolve('hls.js/package.json'));
fs.copyFileSync(path.join(hls,'dist/hls.mjs'),path.join(root,'web/vendor/hls.mjs'));
fs.copyFileSync(path.join(hls,'LICENSE'),path.join(root,'web/vendor/HLS-LICENSE.txt'));
for(const [from,to] of [['.dist/index.js','soundtouch.js'],['.dist/soundtouch-processor.js','soundtouch-processor.js'],['LICENSE','SOUNDTOUCH-LICENSE.txt']]) fs.copyFileSync(path.join(pkg,from),path.join(root,'web/vendor',to));
const python=path.join(root,'android/app/src/main/python');
fs.mkdirSync(python,{recursive:true});
for(const name of ['catalog.py','artist_catalog.py','playlist_import.py']){
 fs.copyFileSync(path.join(root,'provider',name),path.join(python,name));
}
