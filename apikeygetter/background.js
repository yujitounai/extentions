function searchApiKeyPopup() {
	//タブが表示されたときのイベント
	let apisArray=[];
	let iframesArray=[];
	let scriptsArray=[];
	let linksArray=[];
	let apiCounter=0;
	let i=0;

	//重たいので触りたくないドメイン
	const avoiddomains=[
		"gmail.com",
		"amazon.com",
		"amazon.co.jp",
		"facebook.com",
		"youtube.com",
		"google.com",
		"twitter.com",
		"yahoo.co.jp"
	];

	const assets = [
		{ "name" : "AWSのアクセスキー", "regexp" : '"AKIA[\\w]{16}"'},//secretではない
		{ "name" : "AWSのCredentials", "regexp" : '"Credentials"'},//"AccessKeyId" "SessionToken"
		{ "name" : "GOOGLEのAPIキー", "regexp" : '["=]AIza[0-9A-Za-z\\-_]{35}'},
		{ "name" : "プライベートIPアドレス" ,"regexp" : "192\\.168\\.[12]?[\\d]{1,2}\\.[12]?[\\d]{1,2}"},
		{ "name" : "プライベートIPアドレス" ,"regexp" : "172\\.[123]?[0-9]?\\.[12]?[\\d]{1,2}\\.[12]?[\\d]{1,2}"},
		{ "name" : "S3 Bucket" ,"regexp" : "http[s]?://[\\w-]{1,255}?\\.s3\\.[\\w-]{10,20}?\\.amazonaws\\.com/"},
		{ "name" : "slack token" ,"regexp" : "xoxp-[\\d]{13}-[\\d]{13}-[\\d]{13}-[\\w]{32}"},
		{ "name" : "UUID" ,"regexp" : "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"},
		{ "name" : "4gtoken" ,"regexp" : "4gtoken"},//apikeyはUUID
		{ "name" : "Private Key" ,"regexp" : "-----BEGIN [\\w]{2,3} PRIVATE KEY-----"},//RSA DSA EC
		{ "name" : "github access token" ,"regexp" : "[a-zA-Z0-9_-]*:[a-zA-Z0-9_\-]+@github\.com"},
		{ "name" : "json web token" ,"regexp" : "ey[A-Za-z0-9-_=]+\\.ey[A-Za-z0-9-_=]+\\.[A-Za-z0-9-_.+/=]+"},
		{ "name" : "yahoo!japan Client ID" ,"regexp" : "dj0[A-Za-z0-9]{52}-"},
	];
	//ApiKeyを探す
	function searchApiKey(innerhtml,src){
		const DEBUG=0;
		console.log(`****************** \n${src}\n ******************\n`);
		for (key in assets) {
			if (DEBUG==1){
				console.log(`${assets [key].name}を探す\n`);
				console.log(`正規表現は ${assets [key].regexp}\n`);
			}
        	//前後30字を拾う
        	rexexpword=`(.\{0,30\})(${assets[key].regexp})(.\{0,30\})`;
        	let regex = new RegExp(rexexpword,'mg');
        	//matchAllは配列ではなく反復可能オブジェクトが返る
        	let result = innerhtml.matchAll(regex);
        	//結果があればconsoleに書き出し
        	result = Array.from(result); // 配列に変換
        	if(Object.keys(result).length>0){
            	console.log(`${assets [key].name} が見つかった模様\n`);
				apisArray.push(`${src}\n`);
				apisArray.push(`${assets [key].name} が見つかった模様\n`);
            	if (DEBUG==1){
                	console.log(`${result}\n`);
            	}
            	result.forEach((elem, index) => {
                	console.log(`Found: ${index}: ${elem[1]} ${elem[2]} ${elem[3]}\n`);
					apisArray.push(`${elem[1]}🥸${elem[2]}🥳${elem[3]}`);
					apiCounter++;
            	});
        	}else{
            	if (DEBUG==1){
                	console.log(`-------なし------\n`);   
            	}
        	}

		}
	}

	const innerhtml=document.body.parentNode.innerHTML;
	console.log(`-------------:${document.domain}---------\n`);

	let avoidflag=0;
	avoiddomains.forEach(function(avoiddomain){
		if(document.domain.endsWith(avoiddomain)){
			avoidflag=1;
		}
	});

	if (avoidflag==0){
		//DOMツリーから検索
		searchApiKey(innerhtml,location.href);

		//リンクされているスクリプトからAPIキーを探す
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
						searchApiKey(data,script.src);
					}
				})
				.catch((error) => {
					console.log(`Error:${script.src}:${error}\n`);
				});
			}
		});

		//iframe情報を表示
		const iframes = document.querySelectorAll('iframe');
		iframes.forEach(function(iframe){
			if(iframe){
				console.log(`iframe:${iframe.src}`);
				i++;
				iframesArray.push(iframe.src);	
			}
		});
		//リンクされているスクリプト情報
		scripts.forEach(function(script){
			if(script.src){
				console.log(`script:${script.src}`);
				i++;
				scriptsArray.push(script.src);	
			}
		});
		//アイコンに表示させる
		chrome.runtime.sendMessage({badgeText: String(apiCounter)});

		let entity = {};
		entity.hoge = {col1: 'new data'};
		entity.hoge.apikeys=apisArray;
		entity.hoge.iframes=iframesArray;
		entity.hoge.scripts=scriptsArray;

		chrome.storage.local.set(entity, function() {
    		console.log('stored');
		});
	}else{
		//検索しないリストに入っているとき
		chrome.runtime.sendMessage({badgeText: "no"});
	}
}



// タブが更新された時のイベント
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
	//console.log(tab.url); // → 更新されたURL
	if(changeInfo.status=="complete"){// loading,completeの2回発生するので
		console.log(changeInfo.status);
		try{
			console.log(tab.url); // 切り替わったタブのURL
			if(tab.url.startsWith('http://') ||tab.url.startsWith('https://')){
				chrome.scripting.executeScript({
					target: { tabId: tab.id },
					function: searchApiKeyPopup 			
				});
			}
		} catch(e){}
	}
   //chrome.tabs.remove(tabId); // 更新されたタブのidを削除
});

// タブが切り替わった時のイベント
chrome.tabs.onActivated.addListener(function (tabId) {
    chrome.tabs.query({'active': true,'lastFocusedWindow': true}, function (tab) {
		try{
			console.log(tab[0].url); // 切り替わったタブのURL
			if(tab[0].url.startsWith('http://') ||tab[0].url.startsWith('https://')){
				chrome.scripting.executeScript({
					target: { tabId: tab[0].id },
					function: searchApiKeyPopup
				});
			}
		}catch(e){}
        //chrome.tabs.remove(tab[0].id); //切り替わったタブを削除
    });
});

// ウインドウが切り替わったときのイベント
chrome.windows.onFocusChanged.addListener(function(window) {
    chrome.tabs.query({'active': true,'lastFocusedWindow': true}, function (tab) {
		try{
			console.log(tab[0].url); // 切り替わったタブのURL
			if(tab[0].url.startsWith('http://') ||tab[0].url.startsWith('https://')){
				chrome.scripting.executeScript({
					target: { tabId: tab[0].id },
					function: searchApiKeyPopup
				});
			}
		}catch(e){}
        //chrome.tabs.remove(tab[0].id); //切り替わったタブを削除
    });
});

// イベントハンドラーをセットする  
chrome.runtime.onMessage.addListener((message, sender, sendResponse)=> {
	if (message.badgeText != null) {
		chrome.action.setBadgeText({
		  tabId: sender.tab.id,
		  text: message.badgeText,
		}, ()=> chrome.runtime.lastError); //ignore errors due to closed/prerendered tabs
	}
});
// メッセージ送信する
chrome.runtime.sendMessage('YO!');



//todo
//クロスオリジンの取得
//location.originの表示