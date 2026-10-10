import {defineConfig} from '@playwright/test';

export default defineConfig({
 testDir:'./tests/browser',
 testMatch:'*.spec.mjs',
 timeout:90000,
 expect:{timeout:20000},
 retries:process.env.CI?1:0,
 workers:process.env.CI?1:undefined,
 reporter:process.env.CI?[['list'],['html',{open:'never',outputFolder:'playwright-report'}]]:[['list']],
 outputDir:'test-results',
 use:{
  baseURL:'http://127.0.0.1:41821',
  screenshot:'only-on-failure',
  trace:'retain-on-failure',
  actionTimeout:15000
 },
 projects:[
  {name:'chromium-desktop',use:{browserName:'chromium',viewport:{width:1280,height:800}}},
  {name:'chromium-mobile-touch',use:{browserName:'chromium',viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2}}
 ],
 webServer:{
  command:'node server.mjs',
  url:'http://127.0.0.1:41821/api/status',
  cwd:import.meta.dirname,
  env:{PORT:'41821',HISTORIA_DATA_DIR:'.data/browser-smoke'},
  reuseExistingServer:!process.env.CI,
  timeout:120000
 }
});
