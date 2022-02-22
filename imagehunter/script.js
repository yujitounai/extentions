let defaults = {};
defaults.data = {col1: 'no data'};
let img_element;
let img_cnt=0;

//DOMツリー構築終了時
document.addEventListener("DOMContentLoaded", function () {
  //var imageUrl = "https://photo-studio9.com/wp-content/uploads/2014/01/140108sample2.jpg";
  //document.getElementById("img").innerHTML = "<img src =" + imageUrl + " id='img1' width='150' height='150' >" ;
  /*
  var img_element = document.createElement('img');
  img_element.src = 'https://bogus.jp/img1.jpg'; // 画像パス
  img_element.setAttribute("id", "img2");
  img_element.setAttribute("width", "100");
  document.body.appendChild(img_element);
*/
  chrome.storage.local.get(defaults, function(items) {
    //書き出し先タグ
    const imgs = document.getElementById('imgs');
    //storageから読み込んだデータを書き出し
    items.data.imgs.forEach(function(img){
      if(img.startsWith('http://') ||img.startsWith('https://')){
        //spanの作成
        let imgspan_element = document.createElement('span');
        imgspan_element.setAttribute("class", "imagespan");
        imgs.appendChild(imgspan_element);
        //画像へのリンク作成
        let link_element = document.createElement('a');
        link_element.href=img;
        link_element.setAttribute("target", "_blank");
        imgspan_element.appendChild(link_element);
        //画像タグの作成
        let img_element = document.createElement('img');
        img_element.src = img; // 画像パス
        img_element.setAttribute("id", "img_"+img_cnt);
        img_element.setAttribute("height", "100");
        img_element.setAttribute("width", "100");
        img_element.setAttribute("title", img);
        link_element.appendChild(img_element);
        //検索span
        let search_span_element = document.createElement('span');
        imgspan_element.appendChild(search_span_element);
        //Google画像検索へのリンク作成
        const google_imgsearch_url=`https://www.google.co.jp/searchbyimage?image_url=${img}&site=search&hl=ja`;
        
        let google_imgsearch_element = document.createElement('a');
        google_imgsearch_element.href =google_imgsearch_url;
        google_imgsearch_element.setAttribute("id", "Google_"+img_element.id);
        google_imgsearch_element.setAttribute("target", "_blank");          
        google_imgsearch_element.setAttribute("alt", "Google");
        google_imgsearch_element.setAttribute("class", "google_search_link");
        //画像タグの作成
        let google_img_element = document.createElement('img');
        google_img_element.src = 'google.svg'; // 画像パス
        google_img_element.setAttribute("height", "15");
        google_img_element.setAttribute("width", "15");
        google_imgsearch_element.appendChild(google_img_element);

        search_span_element.appendChild(google_imgsearch_element);

        const bing_imgsearch_url=`https://www.bing.com/images/search?view=detailv2&iss=sbi&form=SBIHMP&sbisrc=UrlPaste&q=imgurl:${img}`;
        let bing_imgsearch_element = document.createElement('a');
        bing_imgsearch_element.href =bing_imgsearch_url;
        bing_imgsearch_element.setAttribute("id", "Bing_"+img_element.id);
        bing_imgsearch_element.setAttribute("target", "_blank");          
        bing_imgsearch_element.setAttribute("alt", "Bing");
        bing_imgsearch_element.setAttribute("class", "bing_search_link");
        //画像タグの作成
        let bing_img_element = document.createElement('img');
        bing_img_element.src = 'bing.svg'; // 画像パス
        bing_img_element.setAttribute("height", "15");
        bing_img_element.setAttribute("width", "15");
        bing_imgsearch_element.appendChild(bing_img_element);
        search_span_element.appendChild(bing_imgsearch_element);

        //Yandex
        const yandex_imgsearch_url=`https://yandex.com/images/search?rpt=imageview&url=${img}`
        let yandex_imgsearch_element = document.createElement('a');
        yandex_imgsearch_element.href =yandex_imgsearch_url;
        yandex_imgsearch_element.setAttribute("id", "Yandex_"+img_element.id);
        yandex_imgsearch_element.setAttribute("target", "_blank");          
        yandex_imgsearch_element.setAttribute("alt", "Yandex");
        yandex_imgsearch_element.setAttribute("class", "yandex_search_link");
        //画像タグの作成
        let yandex_img_element = document.createElement('img');
        yandex_img_element.src = 'yandex.png'; // 画像パス
        yandex_img_element.setAttribute("height", "15");
        yandex_img_element.setAttribute("width", "15");
        yandex_imgsearch_element.appendChild(yandex_img_element);

        search_span_element.appendChild(yandex_imgsearch_element);
/*
        //リンクをコピー
        let linkcopy_element = document.createElement('a');
        linkcopy_element.href =`javascript:navigator.clipboard.writeText('${img}')`;
        linkcopy_element.setAttribute("id", "Linkcopy_"+img_element.id);     
        linkcopy_element.setAttribute("alt", "Copy");
        linkcopy_element.setAttribute("class", "copy_link");
        //画像タグの作成
        let linkcopy_img_element = document.createElement('img');
        linkcopy_img_element.src = 'link.png'; // 画像パス
        linkcopy_img_element.setAttribute("height", "15");
        linkcopy_img_element.setAttribute("width", "15");
        linkcopy_element.appendChild(linkcopy_img_element);

        search_span_element.appendChild(linkcopy_element);
        */
        //exif情報の取得
        img_element.onload = function(){
          EXIF.getData(img_element, function() {
            if(Object.keys(EXIF.getAllTags(this)).length === 0 && EXIF.getAllTags(this).constructor === Object){
              console.log(`${img_element.id}:NO EXIF`);
              return;
            }else{
              let make = EXIF.getTag(this, "Make");
              let model = EXIF.getTag(this, "Model");
              let GPSLatitude = EXIF.getTag(this,"GPSLatitude");
              let GPSLongitude = EXIF.getTag(this,"GPSLongitude");
              let XResolution = EXIF.getTag(this,"XResolution");
              let YResolution = EXIF.getTag(this,"YResolution");
              //GPS情報がある
              if(GPSLatitude!==undefined && GPSLongitude!==undefined){
                let exifLongRef = EXIF.getTag("GPSLongitudeRef");
                let exifLatRef = EXIF.getTag("GPSLatitudeRef");
                if (exifLatRef == "S") {
                  var latitude = (GPSLatitude[0]*-1) + (( (GPSLatitude[1]*-60) + (GPSLatitude[2]*-1) ) / 3600);						
                } else {
                  var latitude = GPSLatitude[0] + (( (GPSLatitude[1]*60) + GPSLatitude[2] ) / 3600);
                }
                console.log(`latitude:${latitude}`);

                if (exifLongRef == "W") {
                  var longitude = (GPSLongitude[0]*-1) + (( (GPSLongitude[1]*-60) + (GPSLongitude[2]*-1) ) / 3600);						
                } else {
                  var longitude = GPSLongitude[0] + (( (GPSLongitude[1]*60) + GPSLongitude[2] ) / 3600);
                }
                console.log(`longitude:${longitude}`);
                let mapsurl=`https://www.google.com/maps?q=${latitude},${longitude}`
                console.log(`Google Maps:${mapsurl}`);

                var gps_element = document.createElement('a');
                gps_element.href =mapsurl;
                gps_element.setAttribute("id", "GPS_"+img_element.id);
                gps_element.setAttribute("class", "GPSlink");
                gps_element.setAttribute("target", "_blank");          
                gps_element.textContent="GPS";
                search_span_element.appendChild(gps_element);
                console.log(`${img_element.id}:${make},${model},緯度:${latitude},経度:${longitude}`);
                //https://www.google.com/maps?q=35.31966666666667,139.54766666666666

              }else{
                //デバッグ用に情報表示
                /*
                var gps_element = document.createElement('span');
                gps_element.innerText =`${make},${model} NO GPS DATA` // 画像パス
                gps_element.setAttribute("id", "GPS_"+img_element.id);
                imgspan_element.appendChild(gps_element);
                console.log(`${img_element.id}:${make},${model},${XResolution},${YResolution} NO GPS DATA`);
                */
              }
            }
          });
        };

        img_cnt++;
      }
    });
  });
});


//全ページロード終了時
//window.onload=getExif;

function getExif() {
  var img1 = document.getElementById("img1");
/*
  EXIF.getData(img1, function() {
    if(Object.keys(EXIF.getAllTags(this)).length === 0 && EXIF.getAllTags(this).constructor === Object){
      document.getElementById("exifinfo").style.display = "none";
      document.getElementById("test").innerHTML = "EXIF情報は見つかりませんでした"
      return;
    }else{
      var ImageDescription = EXIF.getTag(this,"ImageDescription");
      var Maker = EXIF.getTag(this, "Make");
      var Model = EXIF.getTag(this, "Model");
      var DateTime = EXIF.getTag(this,"DateTime");
      var ExifVersion = EXIF.getTag(this,"ExifVersion");
      var GPSVersion = EXIF.getTag(this,"GPSVersionID");
      var GPSLatitude = EXIF.getTag(this,"GPSLatitude");
      var GPSLongitude = EXIF.getTag(this,"GPSLongitude");
		  var makeAndModel = document.getElementById("makeAndModel");
      if(ImageDescription === undefined){
        ImageDescription = "未定義";
      }
      if(Maker === undefined){
        Maker = "未定義";
      }
      if(Model === undefined){
        Model = "未定義";
      }
      if(DateTime === undefined){
        DateTime = "未定義";
      }
      if(ExifVersion === undefined){
        ExifVersion = "未定義";
      }
      if(GPSVersion === undefined){
        GPSVersion = "未定義";
      }
      if(GPSLatitude === undefined){
        GPSLatitude = "未定義";
      }
      if(GPSLongitude === undefined){
        GPSLongitude = "未定義";
      }
      document.getElementById('title').innerHTML = ImageDescription;
      document.getElementById('maker').innerHTML = Maker;
      document.getElementById('model').innerHTML = Model;
      document.getElementById('date').innerHTML = DateTime;
      document.getElementById('exifversion').innerHTML = ExifVersion;
      document.getElementById('gpsversion').innerHTML = GPSVersion;
      document.getElementById('latitude').innerHTML = GPSLatitude;
	    document.getElementById('longitude').innerHTML = GPSLongitude;
	    console.log(GPSLongitude)
    }
  });
  */
  var imgnodes = document.querySelectorAll("[id^='img_']");
  //console.log(imgnodes);
  imgnodes.forEach(function(image) {
    
    EXIF.getData(image, function() {
      if(Object.keys(EXIF.getAllTags(this)).length === 0 && EXIF.getAllTags(this).constructor === Object){
        console.log(`${image.id}:NO EXIF`);
        return;
      }else{
        var make = EXIF.getTag(this, "Make");
        var model = EXIF.getTag(this, "Model");
        var GPSLatitude = EXIF.getTag(this,"GPSLatitude");
        var GPSLongitude = EXIF.getTag(this,"GPSLongitude");
        console.log(`${image.id}:${make},${model},緯度:${GPSLatitude},経度:${GPSLongitude}`);
        if(GPSLatitude!==undefined && GPSLongitude!==undefined){
          var gps_element = document.createElement('div');
          gps_element.innerText =image.id+":緯度:"+ GPSLatitude+"経度:"+GPSLongitude; // 画像パス
          gps_element.setAttribute("id", "GPS_"+image.id);
          document.body.appendChild(gps_element);
        }
      }
    });
  });
}
