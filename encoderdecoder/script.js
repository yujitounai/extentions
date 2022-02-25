function unicodeescape(str){
  return str.replace(/[^\x00-\x7F]/g, function(c) {
      return '\\u' + ('000' + c.codePointAt(0).toString(16)).slice(-4);
  });
}
function unicodeunescape(str){
return str.replace(/\\u([a-fA-F0-9]{4})/g, function(x, y) {
  return String.fromCharCode(parseInt(y, 16));
});
}

function unicodeencode(str){
  let encoder = new TextEncoder();
  let uint8Array = encoder.encode(str);
  return(uint8Array); // 72,101,108,108,111
}
function unicodedecode(str){
  var arr = str.split(',');
  var ary_u8 = new Uint8Array(arr); 
  var text_decoder = new TextDecoder();
  var result = text_decoder.decode(ary_u8);
  return (result);
}
function numeric10encode(str){
  let result='';
  for (var i=0; i<str.length; i++) {
      result=result+"&#"+str.codePointAt(i) + ";";
  }
  return (result);
}
function numeric10decode(str){
  str = str.replace(/&#x/g, "");
  var arr = str.split(';');
  result = String.fromCharCode.apply(null, arr);
  return (result);
}

function numeric16encode(str){
  let result='';
  for (var i=0; i<str.length; i++) {
      result=result+"&#x"+str.codePointAt(i).toString(16) + ";";
  }
  return (result);
}
function numeric16decode(str){
  str = str.replace(/&#/g, "");
  var arr = str.split(';');
  arr= arr.map(function(a){
      return "0x"　+　a;
  });
  result = String.fromCharCode.apply(null, arr);
  return (result);
}
function unescapeHTML(escapedHtml) {
const doc = new DOMParser().parseFromString(escapedHtml, 'text/html');
return doc.documentElement.textContent;
}


//HTMLエンコード(数値文字参照)

function buttonClick(event){
  let before = document.getElementById('before').value;
  // form要素を取得
  var element = document.getElementById('wantto') ;
  // form要素内のラジオボタングループ(name="todo")を取得
  var radioNodeList = element.todo ;
  // 選択状態の値(value)を取得 (Bが選択状態なら"b"が返る)
  var todo = radioNodeList.value ;
  if ( todo === "" ) {
      // 未選択状態
  }else if ( todo === "urlencodeComponent" ){
      document.getElementById('after').value=encodeURIComponent(before);
  }else if ( todo === "urldecodeComponent" ){
      document.getElementById('after').value=decodeURIComponent(before);
  }else if ( todo === "urlencode" ){
      document.getElementById('after').value=encodeURI(before);
  }else if ( todo === "urldecode" ){
      document.getElementById('after').value=decodeURI(before);
  }else if ( todo === "base64encode" ){
      document.getElementById('after').value=btoa(encodeURIComponent(before));
  }else if ( todo === "base64decode" ){
      document.getElementById('after').value=decodeURIComponent(atob(before));
  }else if ( todo === "unicodeescape" ){
      document.getElementById('after').value=unicodeescape(before);
  }else if ( todo === "unicodeunescape" ){
      document.getElementById('after').value=unicodeunescape(before);
  }else if ( todo === "numeric16encode" ){
      document.getElementById('after').value=numeric16encode(before);
  }else if ( todo === "numeric16decode" ){
      document.getElementById('after').value=numeric16decode(before);
  }else if ( todo === "numeric10encode" ){
      document.getElementById('after').value=numeric10encode(before);
  }else if ( todo === "numeric10decode" ){
      document.getElementById('after').value=numeric10decode(before);
  }else if ( todo === "unicodeencode" ){
      document.getElementById('after').value=unicodeencode(before);
  }else if ( todo === "unicodedecode" ){
      document.getElementById('after').value=unicodedecode(before);
  }else if ( todo === "unescapeHTML" ){
      document.getElementById('after').value=unescapeHTML(before);
  }

}
//DOMツリー構築終了時
document.addEventListener("DOMContentLoaded", function () {
  //ボタンクリック
  const button = document.getElementById('change');
  button.addEventListener('click', buttonClick);

  //入力値変更
  const before = document.getElementById('before');
  before.addEventListener('input',buttonClick);

  //ラジオボタン変更時
  document.getElementsByName("todo").forEach(
    r => r.addEventListener("change" , buttonClick)
  );
});