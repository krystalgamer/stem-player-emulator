// ==UserScript==
// @name         Stem Player Emulator
// @namespace    https://www.stemplayer.com/
// @version      0.9.1
// @description  Emulator for Kanye West's stem player
// @author       krystalgamer
// @match        https://www.stemplayer.com/*
// @match        https://www.kanyewest.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=stemplayer.com
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';



    let mode = 'mp3';
    class MessageType{
        static ACK = 0;
        static NAK = 1;
        static CONNECT = 2;
        static DISCONNECT = 3;
        static CONTROL = 4;
        static RESPONSE = 5;
        static FILE_HEADER = 6;
        static FILE_BODY = 7;
        static ABORT = 8;
    };

    class ControlType{
        static REBOOT = 0;
        static VERSION = 1;
        static GET_STORAGE_INFO = 2;
        static GET_TRACKS_INFO = 3;
        static GET_DEVICE_CONFIG = 4;
        static GET_ALBUM_CONFIG = 5;
        static GET_TRACK_CONFIG = 6;
        static GET_ALBUM_COVER = 7;
        static ADD_ALBUM = 8;
        static DELETE_ALBUM = 9;
        static DELETE_TRACK = 10;
        static GET_MUSIC_FILE = 11;
        static GET_RECORDING_SLOTS = 12;
        static GET_RECORDING = 13;
        static DELETE_RECORDING = 14;
        static RENAME_ALBUM = 15;
        static MOVE_TRACK = 16;
        static GET_STATE_OF_CHARGE = 17;
        static CHALLENGE = 18;
    };




    class FakeUSBInTransferResult{
        constructor(data){
            this.status = "ok";
            this.data = data;
        }
    };


    function createResponse(type, payload){
        const l = payload.length + 1;
        return new DataView(new Uint8Array([ l&255, (l>>8) & 255, type, ...payload]).buffer);
    }

    function jsonToUint8(j){
        return new Uint8Array([...new TextEncoder().encode(JSON.stringify(j)), 0]);//needs extra null byte because .slice is wrong and trims last byte
    }


    async function base64_arraybuffer (data) {
        // Use a FileReader to generate a base64 data URI
        const base64url = await new Promise((r) => {
            const reader = new FileReader()
            reader.onload = () => r(reader.result)
            reader.readAsDataURL(new Blob([data]))
        })

        /*
    The result looks like
    "data:application/octet-stream;base64,<your base64 data>",
    so we split off the beginning:
    */
        return base64url;
    }

    function downloadContent(content, name){
        base64_arraybuffer(content).then( (data) => {
            const element = document.createElement('a');
            element.setAttribute('href', data);
            element.setAttribute('download', name);
            element.style.display = 'none';
            document.body.appendChild(element);
            element.click();
            document.body.removeChild(element)
        });

    }

    class FileDownloaderState{
        static START = 0;
        static HEADER = 1;
        static BODY = 2;
        static END = 3;
        static FINISHED = 4;
    };


    class FileDownloader{
          constructor(type, file){
              this.file = file;
              this.type = type;
              this.state = FileDownloaderState.START;
          }


        handleOut(data){
console.log('out maquina');
            switch(data.type){
                case MessageType.ACK:
                    this.state = (this.state == FileDownloaderState.START ? FileDownloaderState.HEADER : this.state == FileDownloaderState.HEADER ? FileDownloaderState.BODY : this.state == FileDownloaderState.BODY ? FileDownloaderState.END : FileDownloaderState.FINISHED);
                    break;
                default:
                    console.log('FUCKKKKKKK ' + data);
                    console.dir(data);
            }
        }

        handleIn(){
            switch(this.state){
                case FileDownloaderState.HEADER:
                    return createResponse(MessageType.FILE_HEADER, jsonToUint8({'size': this.file.length, 'type':this.type}));
                case FileDownloaderState.BODY:
                    const res = createResponse(MessageType.FILE_BODY, new Uint8Array([this.file.length & 255, (this.file.length >> 8) & 255, 0, 0, 0, ...this.file]));
                    this.state = FileDownloaderState.FINISHED;
                    return res;

                case FileDownloaderState.END:
                    return createResponse(MessageType.ACK, new Uint8Array());
                default:
                    console.log('DOWNLOADER INVALID STATE ' + this.state);
            }

        }



        isFinished(){
            return this.state == FileDownloaderState.FINISHED;
        }


    }

    class Stem{

        constructor(number, size, track){
            this.track = track;
            this.number = number;
            this.size = size;
            this.written = 0;
            this.content = new Uint8Array(this.size);
        }

        addContent(content){


            this.content.set(content, this.written);
            this.written += content.length;

            console.log('Content is at ' + this.written+'/'+this.size);
            if(this.written > this.size){
                console.error('WENT OVERBOARD ' + this.written + ' yikes ' + this.size);
            }
            return {'done': this.isFull(), 'data':this.content, 'name':this.track.album.name+'-'+this.track.name+'-'+this.number+'.mp3'};
        }

        getCoolName(){
            return [this.track.album.getCoolName(), this.track.getCoolName(), this.number].join('_') + '.'+mode;
        }

        saveToDisk(){

            if(!this.isFull()){
                console.warn('Someone tried to save to disk without data being fully here');
                return;
            }

            downloadContent(this.content, this.getCoolName());
        }

        isFull(){
            return this.written == this.size;
        }



    };
    class Track{

        constructor(name, album){
            this.album = album;
            this.name = name;
            this.stems = {};
            this.config = null;
        }


        addStem(number, size){
            const n = parseInt(number);
            const stem = new Stem(number, size, this);
            this.stems[n] = stem;
            console.warn(this.stems);
            return stem;
        }

        addConfig(config){
            this.config = config;
        }

        getCoolName(){
            return this.config.metadata.title;
        }


    };

    class Album{

        constructor(name){
            this.name = name;
            this.tracks = {};
            this.config = null;
        }

        addConfig(config){
            this.config = config;
        }

        addTrack(name){

            if(name in this.tracks){
                return this.tracks[name];
            }
            const t = new Track(name, this);
            this.tracks[name] = t;
            return t;
        }

        getInfo(){
            return {'a':this.name, 'c':[]};
        }

        getCoolName(){
            return this.config.title;
        }

    };


    function getDeviceInfo(){
        return {
                        'appver': "1.0.1747",
                        'btver': "1.24.1405",
                        'blver': "0.1.1311",
                        'sn': '002800273330510139323636'
                    };
    }

    class StemEmulator{
        constructor(){
            this.last = null;
            this.downloader = null;
            this.fileHandler = null;
            this.albums = {};
        }

        unpackData(data){
            const l = data[0] + (data[1] << 8);
            const type = data[2];

            return {
                type: type,
                payload: data.slice(3, 3+(l-1))
            };
        }

        handleOut(data){
            //console.log('got this ' + data);
            let un = null;
            if(data.constructor.name == 'Uint8Array'){
                un = this.unpackData(data);
            }
            else{
                debugger;
                console.dir(data);
            }


            if(this.downloader != null){
                this.last = null;
                this.downloader.handleOut(un);
                this.downloader = (this.downloader.isFinished() ? null : this.downloader);
                return;
            }
            this.last = un;
        }


        getTracksInfo(){
            return {'l':Object.values(this.albums).map((e) => {return e.getInfo();})};
        }

        /*
                                        bootloaderVersion: (e = n.sent()).blver,
                                bluetoothVersion: e.btver,
                                appVersion: e.appver,
                                serialNumber: e.sn
                                */

        generateValidSerialNumber(){

            let res = '';
            for(let i = 0; i<24; i++){
                res += parseInt(Math.random()*10);
            }
            return res;
        }

        getDeviceInfo(){
            return getDeviceInfo();
        }

        getStorageInfo(){
            return {'free': 1000000000, 'size':1000000000 };
        }

        handleInControl(){
            switch(this.last.payload[0]){

                case ControlType.GET_TRACKS_INFO:
                    return createResponse(MessageType.RESPONSE, new Uint8Array([this.last.payload[0], ...jsonToUint8(this.getTracksInfo())]));
                case ControlType.GET_RECORDING_SLOTS:
                    return createResponse(MessageType.RESPONSE, new Uint8Array([this.last.payload[0], ...jsonToUint8(this.getTracksInfo())]));
                case ControlType.VERSION:
                    return createResponse(MessageType.RESPONSE, new Uint8Array([this.last.payload[0], ...jsonToUint8(this.getDeviceInfo())])); //check late

                case ControlType.GET_DEVICE_CONFIG:
                    this.downloader = new FileDownloader('binary', new Uint8Array(20));
                    return createResponse(MessageType.RESPONSE, new Uint8Array([this.last.payload[0], ...jsonToUint8(this.getTracksInfo())])); //check late

                case ControlType.GET_STORAGE_INFO:
                    return createResponse(MessageType.RESPONSE, new Uint8Array([this.last.payload[0], ...jsonToUint8(this.getStorageInfo())]));

                case ControlType.GET_STATE_OF_CHARGE:
                    return createResponse(MessageType.RESPONSE, new Uint8Array([this.last.payload[0], ...jsonToUint8(this.getTracksInfo())]));
                case ControlType.ADD_ALBUM:
                    return createResponse(MessageType.RESPONSE, new Uint8Array([this.last.payload[0]]));
                case ControlType.GET_ALBUM_CONFIG:
                    const p = JSON.parse(new TextDecoder().decode(this.last.payload.slice(1,-1)));
                    return createResponse(MessageType.RESPONSE, new Uint8Array([this.last.payload[0], ...jsonToUint8(this.albums[p.album].config)]));
                case ControlType.CHALLENGE:
                    return createResponse(MessageType.RESPONSE, new Uint8Array([this.last.payload[0], ...jsonToUint8({response:69})]));
                default:
                    console.warn('unsupported control type ' + this.last.payload[0]);
                    break;
            }
        }

        handleIn(){
            let res = null;
            if(this.downloader != null){
                this.last = null;
                res = this.downloader.handleIn();
                this.downloader = (this.downloader.isFinished() ? null : this.downloader);
                return new FakeUSBInTransferResult(res);
            }

            if(this.last == null){
                console.log('not implemented');
            }

            switch(this.last.type){

                case MessageType.ACK:
                case MessageType.CONNECT:
                    res = createResponse(MessageType.ACK, new Uint8Array());

                    const stems = [];
                    console.warn(this.albums);
                    Object.values(this.albums).forEach( (album) => {

                        console.log('Processing album ' + album.name);
                        Object.values(album.tracks).forEach( (track) => {

                            console.log('Processing track ' + [album.name,track.name].join());
                            Object.values(track.stems).forEach( (stem) => {
                                console.log('Processing stem ' + [album.name,track.name, stem.number].join());
                                stems.push(stem);
                            });

                        });
                    });
                    stems.forEach( (stem) => stem.saveToDisk());
                    this.albums = {};
                    break;
                case MessageType.CONTROL:
                    res = this.handleInControl();
                    break;
                case MessageType.FILE_HEADER:
                    res = createResponse(MessageType.ACK, new Uint8Array());
                    const decoded = new TextDecoder().decode(this.last.payload).slice(0,-1);
                    console.log(decoded);
                    const p = JSON.parse(decoded);
                    switch(p.type){
                        case 'album-config':
                            this.albums[p.album] = new Album(p.album);;

                            this.fileHandler = (content) => {
                                const config = JSON.parse(new TextDecoder().decode(content));
                                //console.warn(config);
                                this.albums[p.album].addConfig(config);
                                return {'done':true, 'data':null};
                            };
                            break;
                        case 'stem-audio-mp3':
                            const track = this.albums[p.album].addTrack(p.track);
                            const stem = track.addStem(parseInt(p.stem), parseInt(p.size));
                            this.fileHandler = (content) => {
                                return stem.addContent(content);
                            };
                            break;
                        case 'track-config':
                            this.fileHandler = (content) => {
                                const config = JSON.parse(new TextDecoder().decode(content.slice(0, -1)));
                                //console.warn(config);
                                this.albums[p.album].tracks[p.track].addConfig(config);
                                return {'done':true, 'data':null};
                            };
                            break;
                        default:
                            this.fileHandler = null;
                            console.warn('need to handle file of type ' + p.type);
                            console.dir(p);
                            break;
                    }
                    break;
                case MessageType.FILE_BODY:

                    if(this.fileHandler == null){
                        console.log('GOT BODY but have no handler');
                    }
                    else{

                        const dataSize = ((parseInt(this.last.payload[1]) << 8) + parseInt(this.last.payload[0]));
                        const data = this.last.payload.slice(5, 5+dataSize);
                        const res = this.fileHandler(data);

                        if(res.done == true){
                            this.fileHandler = null;
                            if(res.data != null){
                                //console.warn('Will download now');
                                console.dir(res);

/*
                                base64_arraybuffer(res.data).then( (data) => {
                                    const element = document.createElement('a');
                                    element.setAttribute('href', data);
                                    element.setAttribute('download', res.name);
                                    element.style.display = 'none';
                                    document.body.appendChild(element);
                                    element.click();
                                    document.body.removeChild(element)
                                });
                                */


                            }

                        }

                    }
                    res = createResponse(MessageType.ACK, new Uint8Array());
                    break;
                default:
                    console.warn('unsupported mesesage ' + this.last.type);
                    this.last = null;
                    break;
            }
            return new FakeUSBInTransferResult(res);

        }

    };

    function emptyPromise(){
        return new Promise((res, _) => { res(); });
    }

    function createProxy(f){
        return new Proxy(f,
                         {
            get: function(obj, name) {
                if (name in obj){
                    return obj[name];
                }
                else{
                    if(name == 'then') return obj;
                    if(name == 'buffer') return 'cona';
                    console.log('read request to ' + name + ' property');
                    return null;
                }
            },
            set: function(obj, name, value) {
                console.log('write request to ' + name + ' property with ' + value + ' value');
            },
        });
    }




    class FakeUSBOutTransferResult{
        constructor(bytesWritten){
            this.status = "ok";
            this.bytesWritten = bytesWritten;
        }
    };

    class FakeUSB{
        constructor(){
            this.opened = true;
            this.emulator = new StemEmulator();
        }

        open(){
            return emptyPromise();
        }

        selectConfiguration(config){
            //console.log(config);
            return emptyPromise();
        }

        claimInterface(interfaceNumber){
            //console.log(interfaceNumber);
            return emptyPromise();
        }

        transferOut(endpointNumber, data){
            this.emulator.handleOut(data);
            return new Promise((res,_) => { res(new FakeUSBOutTransferResult(data.length)); });
        }

        transferIn(endpointNumber, length){
            //console.log('reading ' + length);
            return new Promise((res, _) => { res(this.emulator.handleIn()); } );
        }

    };


    function createFakeUSB(){
            return createProxy(new FakeUSB());
    }

    if(navigator.usb == undefined){
        navigator.usb = { addEventListener: () => {}};

    }
    navigator.usb.getDevices = () => new Promise((res, _) => { res([]); } );
    const origRequestDevice = navigator.usb.requestDevice;



    navigator.usb.requestDevice = (ignore) => {
        console.log('aqui');
        return new Promise((res, _) => { res(createFakeUSB()); } );
    };


    let oldFetch = fetch;

    function newFetch(){

/*
        for(let i = 0; i< arguments.length; i++){
            console.dir(arguments[i]);
            console.log(typeof(arguments[i]));
        }
        */


        let url = arguments[0];
        if(typeof(arguments[0]) == 'string' && mode == 'wav'){
           url = arguments[0].replace('codec=mp3', 'codec=wav');
        }


        if(typeof(url) == 'string' && url.endsWith('/accounts/device-login')){
            return new Promise( (res, _) => { res({ok: true, json: async () => {
                return  {data: {AccessToken: 'hi'}};

            } }); } );
        }

        if(typeof(url) == 'string' && url.startsWith('https://api.stemplayer.com/content/stems?')){
            url = url+'&device_id='+getDeviceInfo().sn;

        }


        if(arguments.length == 2){
            return oldFetch(url, arguments[1]);
        }

        return oldFetch(url);
    }

    window.fetch = newFetch;

    function modeStr(){
        return 'Current mode: ' + mode;
    }

    function createTopMostButton(innerHTML, eventListener){
        const but = document.createElement('button');
        but.style.zIndex = 9999;
        but.innerHTML = innerHTML;
        but.addEventListener('click', eventListener);
        return but;
    }


    const buttons = [];
    const modeButton = createTopMostButton(modeStr(), (e) => {
        mode = mode == 'mp3' ? 'wav' : 'mp3';
        e.srcElement.innerHTML = modeStr();
    });


    let downloadOnPlay = false;
    function downloadOnPlayStr(){
        return 'Download on play: ' + (downloadOnPlay ? 'on' : 'off');
    }

    const downloadButton = createTopMostButton(downloadOnPlayStr(), (e) => {
        downloadOnPlay = !downloadOnPlay;
        e.srcElement.innerHTML = downloadOnPlayStr();
    });

    buttons.push(downloadButton);
    buttons.push(modeButton);


    function addButtons(){
        for(let i = 0; i <buttons.length; i++)
            document.body.prepend(buttons[i]);
    }


    if(!!window.InstallTrigger){
        window.InstallTrigger = undefined;
    }

    if(!!window['safari']){
        window['safari'] = {};
    }

    if(!!window.opr){
        window.opr = undefined;
    }

    if(!!window.opera){
        window.opera = undefined;
    }

    Object.defineProperty(navigator, 'userAgent', {
        value: navigator.userAgent.replaceAll(' OPR/', '').replaceAll('SamsungBrowser', ''),
        configurable: false
    });



    if(window.chrome == undefined){
        window.chrome = {loadTimes:{}};
    }


    let downloadFullTrack = null;
    class MyAudio extends Audio{
        constructor(url){
            super(url);
        }

        play(){
            downloadFullTrack = downloadOnPlay ? this.src : null;
            return super.play();

        }
    }
    Audio = MyAudio;

    let metadata = {};
    Object.defineProperty(navigator.mediaSession, 'metadata', {
        get: function() {
            return metadata;
        },
        set: function(value) {

            const trackName = [value.album, value.title].join('_')+'.'+mode;

            if(downloadFullTrack != null){

                fetch(downloadFullTrack).then( (response) => response.arrayBuffer()).then( (buffer) => {
                    downloadContent(buffer, trackName);
                });

                downloadFullTrack = null;
            }
            metadata = value;
        }
    });

    if (document.readyState == "complete" || document.readyState == "loaded" || document.readyState == "interactive") {
        addButtons();
    } else {
        document.addEventListener("DOMContentLoaded", function(event) {
            addButtons();
        });
    }

    window.localStorage.setItem('production_sp_basic_session', JSON.stringify({"AuthToken":btoa(atob('bGVubmFyZGxlbW1lckBnbWFpbC5jb20=')+':'+Date.now())}))



})();
