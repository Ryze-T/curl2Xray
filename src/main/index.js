import { app, shell, BrowserWindow,ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
const curlConverter = require('curlconverter')
const request = require('request')
const { spawn } = require('child_process');
const http = require("http");
const util = require('util');
const Store = require('electron-store');
const fs = require('fs');


var pid = 0
const store = new Store();

function xrayExist(file) {
  return fs.existsSync(file + "/xray")
}

function webhookHandle(win){
    var server = http.createServer(function (req, rsp){
        let data = []
        req.on('data', chunk => {
            data.push(chunk)
        })
        req.on('end', () => {
            var jsonData = JSON.parse(data)
            if(jsonData.type == "web_vuln" || jsonData.type == "host_vuln"){
                var res = util.format('{"addr":"%s","payload":"%s","plugin":"%s"}',jsonData.data.detail.addr,jsonData.data.detail.payload,jsonData.data.plugin)
                win.webContents.send('xray-res', res)
            }
            if(jsonData.type == "web_statistic"){
                if(jsonData.data.num_found_urls == 0){
                    win.webContents.send('log-sender', "扫描结束")
                }
            }
        })
    });
    server.listen(10001);
    console.log("Sever Running At http://localhost:10001");
}


function xraying(win,path){
  if(pid == 0 || pid == undefined){
    const xray = spawn('./xray', ['webscan','-listen','127.0.0.1:10000','--webhook-output','http://localhost:10001'],{cwd:path})
    //const xray = spawn('xray.exe', ['webscan','-listen','127.0.0.1:9999'])
    xray.unref()
    pid = xray.pid
    xray.stdout.on('data', (data) => {
        win.webContents.send('xray-sender',`${data}`)
    });
    xray.on('close', (code) => {
        win.webContents.send('xray-sender',`child process exited with code ${code}`)

    });
  }
  else{
    win.webContents.send('log-sender',"xray 已开启，请关闭")
  }
}

function xrayStop(){
    if(pid != 0){
        process.kill(pid)
    }
    pid = 0
}

function httpSender(curlCmd,id,win){
    const proxy = "http://127.0.0.1:10000"
    var json = false
    var curl = JSON.parse(curlCmd)
    console.log(curl)
    if(curl.method == "get"){
        request({
            url: curl.raw_url,
            method: curl.method,
            headers: curl.headers,
            proxy: proxy,
            rejectUnauthorized: false,
        },(err,rep,body) => {
            if(err){
                win.webContents.send('log-sender', id+" 错误: "+err)
            }
            // body表示返回的数据
            if(body){     
                if(rep.statusCode != 200){
                    win.webContents.send('log-sender', id+" 状态码异常: "+rep.statusCode)
                }
            }
        })
    }else{
        const postData = JSON.parse(Object.keys(curl.data)[0])
        if(curl.headers.hasOwnProperty("Content-Type")){
            if(curl.headers['Content-Type'] == "application/json"){
                json = true
            }
        }
        request({
            url: curl.raw_url,
            method: curl.method,
            headers: curl.headers,
            body: postData,
            json: json,
            proxy: proxy,
            rejectUnauthorized: false,
        },(err,rep,body) => {
            if(err){
                win.webContents.send('log-sender', id+"错误: "+err)
            }
            // body表示返回的数据
            if(body){
                if(rep.statusCode != 200){
                    win.webContents.send('log-sender', id+" 状态码异常: "+rep.statusCode)
                }
            }
        })
    }

}

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 790,
    show: false,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
    }
  })

  webhookHandle(mainWindow)
    ipcMain.handle('curlScan', (event,msg) => {
        const curlObject = JSON.parse(msg)
        const curlsNum = Object.keys(curlObject).length
        if(curlsNum > 1 || curlObject[0] != ""){
            for(var i = 0; i < curlObject.length; i++){
                var curlCmd = curlConverter.toJsonString(curlObject[i])
                curlCmd.replace("\\\\n","")
                httpSender(curlCmd,i,mainWindow)
            }
        }
    })

    ipcMain.handle('xray-start',(event,msg) => {
        xraying(mainWindow,msg)
    })

    ipcMain.handle('xray-stop',xrayStop)

    ipcMain.handle('path-set',(event,msg) =>{
      store.set('xpath',msg)
      mainWindow.webContents.send('path-exist',xrayExist(msg))
    })


  mainWindow.on('ready-to-show', () => {

    const xpath = store.get('xpath')

    mainWindow.webContents.send('path-get',xpath)

    mainWindow.webContents.send('path-exist',xrayExist(xpath))

    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  app.quit()
})

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
