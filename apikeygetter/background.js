function searchApiKeyMain() {
	//document.body.style.backgroundColor = 'red';
	//console.log(document.body.parentNode.innerHTML)
	const assets = [
		{ "name" : "郵便番号", "regexp" : '[\\d]{3}-[\\d]{4}'},//for test
		{ "name" : "AWSのアクセスキー", "regexp" : '"AKIA[\\w]{16}"'},//secretではない
		{ "name" : "AWSのCredentials", "regexp" : '"Credentials"'},//"AccessKeyId" "SessionToken"
		{ "name" : "GOOGLEのAPIキー", "regexp" : '"AIza[0-9A-Za-z\\-_]{35}"'},
		{ "name" : "プライベートIPアドレス" ,"regexp" : "192\\.168\\.[12]?[\\d]{1,2}\\.[12]?[\\d]{1,2}"},
		{ "name" : "プライベートIPアドレス" ,"regexp" : "172\\.[123]?[0-9]?\\.[12]?[\\d]{1,2}\\.[12]?[\\d]{1,2}"},
		{ "name" : "S3 Bucket" ,"regexp" : "http[s]?://[\\w-]{1,255}?\\.s3\\.ap-[\\w-]{10,20}?\\.amazonaws\\.com/"},
	];
	//ApiKeyを探す
	function searchApiKey(label,innerhtml,src){
		label.value += `********************\n${src}\nから探す \n********************\n`
		for (key in assets) {
			label.value += `${assets [key].name}を探す\n`;
			label.value += `正規表現は ${assets [key].regexp}\n`;
			var regex = new RegExp(assets [key].regexp,'mg');
			var result = innerhtml.match(regex);
			//結果があればconsoleに書き出し
			if(result){
				//label.value += `${result}\n`;
				result.forEach((elem, index) => {
					label.value += `Found: ${index}: ${elem}\n`;
				});
				label.value += `------\n`;
			}else{
				label.value += `なし\n------\n`;
			}
		}
	}


	//UIの作成
	var d = document,id = "APIKeySearch",parentel = d.getElementById(id);
	//メインウインドウ
	if (!parentel) {
		parentel = d.createElement("div");
		d.body.appendChild(parentel);
		parentel.setAttribute("id", id);
		parentel.setAttribute("style","position:fixed;top:10px;right:10px;padding:10px;background:#fff;font:12px/18px monospace;z-index:99999;max-height:100%;overflow:auto;border-radius:8px;border:1px solid #000");
		parentel.style.backgroundColor="#ff9900";
		parentel.style.width="400px";
		parentel.style.display="block";
		const parenttitle = document.createElement("span");
		parenttitle.setAttribute("style","color: #FFF;font-weight: 900;font-size:24px; font-family: 'Open Sans', sans-serif; width:340px");
		const parenttext = document.createTextNode("SearchAPIKey");
		
		parenttitle.appendChild(parenttext);
		parentel.appendChild(parenttitle);
		parentel.addEventListener("click",handler,!1);//イベントハンドラを紐付け

		const switch_close = document.createElement("a");
		const close_text = document.createTextNode("close");
		switch_close.setAttribute("id", "close");
		switch_close.setAttribute("href", "#");
		switch_close.setAttribute("style","color: #050505;font-weight: 900;font-size:24px; font-family: 'Open Sans', sans-serif;float:right;border:1px solid;background:#FFF;margin:0pt;");
		switch_close.appendChild(close_text);
		parentel.appendChild(switch_close);

		var property = document.createElement('div');

		property.innerText = "location.origin:"+location.origin;
		property.setAttribute("style","border:1px solid;background:#FFF;width:370px;margin:1pt;padding:1pt;");
		property.style.backgroundColor="#FFF9C4";
		parentel.appendChild(property);

		var label = document.createElement('textarea');//labelといいながらtextarea
		var propertyid = "property_parent";
		var labelid = "label_parent";

		label.setAttribute("for", propertyid);
		label.setAttribute("id", labelid);

		var innerhtml=document.body.parentNode.innerHTML;
		//DOMツリーから検索
		searchApiKey(label,innerhtml,location.href);

		//ページ内からリンクされているJSから探す
		const scripts = document.querySelectorAll('script');
		scripts.forEach(script => {
			//見つかったか
			//const indexOfFirst = script.src.indexOf(location.origin);
			//label.value += `The index of the first "${location.origin}" from the beginning is ${indexOfFirst}\n`;
			//CORSは気にせず同じオリジンからしか取得しない
			//if(indexOfFirst==0){
			if(script.src.indexOf('data')==-1){//dataスキーマはヤバい
				fetch(script.src)//no-corsにすると余計なトラフィックが起こるのでしない
			  	.then(res=>res.text())
			  	.then(data=>{
					if(script.src){
						searchApiKey(label,data,script.src);
					}
				})
				.catch((error) => {
					label.value+=`Error:${script.src}:${error}\n---------\n`;
				});
			}
		});

		label.setAttribute("style","font-size:9pt;border:2px solid;background:#FFF;width:380px;height: 500px;margin:1pt;padding:0pt;");
		parentel.appendChild(label);



	}


	function handler(e, t) {
		t=e.target;
		e.preventDefault();
		switch (t.id) {
            case "close":
				parentel.style.display="none";
				d.body.removeChild(parentel);
				break;
		};
	}

}



chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: searchApiKeyMain
  });
});

// イベントハンドラーをセットする  
chrome.runtime.onMessage.addListener(function (message) {
	console.log(message);
});
// メッセージ送信する
chrome.runtime.sendMessage('YO!');
