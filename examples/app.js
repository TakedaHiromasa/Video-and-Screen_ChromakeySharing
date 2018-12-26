/* eslint-disable require-jsdoc */
/**
 * SkyWay Screenshare Sample App
 * @author NTT Communications(skyway@ntt.com)
 * @link https://github.com/nttcom/ECLRTC-ScreenShare
 * @license MIT License
 */

$(function() {
    var canvas = document.getElementById("myCanvas0");
    var ctx = canvas.getContext("2d");
    var canvas1 = document.getElementById("myCanvas1");
    var ctx1 = canvas1.getContext("2d");
    var canvas2 = document.createElement("canvas");
    var ctx2 = canvas2.getContext("2d");
    canvas2.width = 320;
    canvas2.height = 240;

    // API key (bc26d227-0bf2-460a-b2cb-129a0dfafdc2 can only be used on localhost)
    const APIKEY = 'Your APIKEY';

    // Call object
    let existingCall = null;

    // localStream
    let localStream = null;

    // Create Peer object
    const peer = new Peer({key: APIKEY, debug: 3});

    // Prepare screen share object
    const ss = ScreenShare.create({debug: true});

    // Get peer id from server
    peer.on('open', () => {
      $('#my-id').text(peer.id);
    });

    // Set your own stream and answer if you get a call
    peer.on('call', call => {
      call.answer(localStream);
      step3(call);
      console.log('event:recall');
    });

    // Error handler
    peer.on('error', err => {
      alert(err.message);
      step2();
    });

  // Call peer
  $('#make-call').on('click', () => {
    const call = peer.call($('#otherpeerid').val(), localStream);
    step3(call);
  });

  // Finish call
  $('#end-call').on('click', () => {
    existingCall.close();
    step2();
  });

  // Get media stream again
  $('#step1-retry').on('click', () => {
    $('#step1-error').hide();
    step1();
  });

  // Start screenshare
  $('#start-screen').on('click', () => {
    if (ss.isScreenShareAvailable() === false) {
      alert('Screen Share cannot be used. Please install the Chrome extension.');
      return;
    }

    ss.start({
      width:     $('#Width').val(),
      height:    $('#Height').val(),
      frameRate: $('#FrameRate').val(),
    })
      .then(stream => {
        $('#my-video2')[0].srcObject = stream;
        localStream = canvas2.captureStream($('#FrameRate').val());

        if (existingCall !== null) {
          const peerid = existingCall.peer;
          existingCall.close();
          const call = peer.call(peerid, localStream);
          step3(call);
        }
      })
      .catch(error => {
          console.log(error);
      });

      $('#my-video2')[0].addEventListener("loadedmetadata",function(e) {
              setInterval(function(e) {
                  //videoタグの描画をコンテキストに描画
                  ctx1.drawImage($('#my-video2')[0],0,0,canvas1.width,canvas1.height);
              },33);
      });

  });

  // End screenshare
  $('#stop-screen').on('click', () => {
    ss.stop();
    localStream.getTracks().forEach(track => track.stop());
  });

  // Camera
  $('#start-camera').on('click', () => {
    navigator.mediaDevices.getUserMedia({audio: true, video: true})
      .then(stream => {
        $('#my-video')[0].srcObject = stream;
        localStream = canvas2.captureStream($('#FrameRate').val());

        if (existingCall !== null) {
          const peerid = existingCall.peer;
          existingCall.close();
          const call = peer.call(peerid, localStream);
          step3(call);
        }
      })
      .catch(err => {
        $('#step1-error').show();
      });

      $('#my-video')[0].addEventListener("loadedmetadata",function(e) {
              ctx.translate(canvas.width,0);
              ctx.scale(-1,1);

              setInterval(function(e) {
                  //videoタグの描画をコンテキストに描画
                  ctx.drawImage($('#my-video')[0],0,0,canvas.width,canvas.height);
                  chromaKey();
              },33);
      });
  });

  // Start step 1
  step1();

  function step1() {
    navigator.mediaDevices.getUserMedia({audio: true, video: true})
      .then(stream => {
        $('#my-video')[0].srcObject = stream;
        $('#FrameRate').captureStream($('#FrameRate').val());
        localStream = canvas2.captureStream($('#FrameRate').val());
        step2();
      })
      .catch(err => {
        $('#step1-error').show();
      });

      $('#my-video')[0].addEventListener("loadedmetadata",function(e) {
              ctx.translate(canvas.width,0);
              ctx.scale(-1,1);

              setInterval(function(e) {
                  //videoタグの描画をコンテキストに描画
                  ctx.drawImage($('#my-video')[0],0,0,canvas.width,canvas.height);
                  chromaKey();
              },33);
      });
  }

  function step2() {
    // Update UI
    $('#step1, #step3').hide();
    $('#step2').show();
  }

  function step3(call) {
    // Close any existing calls
    if (existingCall) {
      existingCall.close();
    }

    // Wait for peer's media stream
    call.on('stream', stream => {
      $('#their-video')[0].srcObject = stream;
      $('#step1, #step2').hide();
      $('#step3').show();
    });

    // If the peer closes their connection
    call.on('close', step2);

    // Save call object
    existingCall = call;

    // Update UI
    $('#their-id').text(call.peer);
    $('#step1, #step2').hide();
    $('#step3').show();
  }


  // 消す色と閾値
  var chromaKeyColor = {r: 0, g: 255, b: 0},
      colorDistance = 30;

  // クロマキー処理
  var chromaKey = function () {
      var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height),
          data = imageData.data; //参照渡し

      // dataはUint8ClampedArray
      // 長さはcanvasの width * height * 4(r,g,b,a)
      // 先頭から、一番左上のピクセルのr,g,b,aの値が順に入っており、
      // 右隣のピクセルのr,g,b,aの値が続く
      // n から n+4 までが1つのピクセルの情報となる

      for (var i = 0, l = data.length; i < l; i += 4) {
          var target = {
                  r: data[i],
                  g: data[i + 1],
                  b: data[i + 2]
              };

          // chromaKeyColorと現在のピクセルの三次元空間上の距離を閾値と比較する
          // 閾値より小さい（色が近い）場合、そのピクセルを消す
          if (getColorDistance(chromaKeyColor, target) < colorDistance) {
              // alpha値を0にすることで見えなくする
              data[i + 3] = 0;
          }
      }

      ctx.putImageData(imageData, 0, 0);
      ctx2.drawImage(canvas1,0,0,canvas.width,canvas.height);
      ctx2.drawImage(canvas,0,0,canvas.width,canvas.height);
  };

  // r,g,bというkeyを持ったobjectが第一引数と第二引数に渡される想定
  var getColorDistance = function (rgb1, rgb2) {
      // 三次元空間の距離が返る
      return Math.sqrt(
          Math.pow((rgb1.r - rgb2.r), 2) +
          Math.pow((rgb1.g - rgb2.g), 2) +
          Math.pow((rgb1.b - rgb2.b), 2)
      );
  };

  var color = document.getElementById('color');
  color.addEventListener('change', function () {
      // フォームの値は16進カラーコードなのでrgb値に変換する
      chromaKeyColor = color2rgb(this.value);
  });

  var color2rgb = function (color) {
      color = color.replace(/^#/, '');
      return {
          r: parseInt(color.substr(0, 2), 16),
          g: parseInt(color.substr(2, 2), 16),
          b: parseInt(color.substr(4, 2), 16)
      };
  };

  var distance = document.getElementById('distance');
  distance.style.textAlign = 'right';
  distance.addEventListener('change', function () {
      colorDistance = this.value;
  });

});
