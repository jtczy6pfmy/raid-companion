import {optimiseArtifacts} from './artifact-engine.js?v=20261012-3';
self.onmessage=event=>{try{self.postMessage({ok:true,...optimiseArtifacts(event.data)})}catch(error){self.postMessage({ok:false,error:error.message})}};
