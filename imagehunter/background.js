function enumerateImages() {
	console.log(1)
	//タブが表示されたときのイベント
	let imgsArray=[];
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
		console.log("test")
		//image情報を表示
		const imgs = document.querySelectorAll('img');
		imgs.forEach(function(img){
			if(img){
				console.log(`img:${img.src}`);
				if(img.src.startsWith('http://') ||img.src.startsWith('https://')){
					i++;
					imgsArray.push(img.src);
				}
			}
		});

		//アイコンに表示させる
		chrome.runtime.sendMessage({badgeText: String(i)});

		let entity = {};
		entity.data = {col1: 'new data'};
		entity.data.imgs=imgsArray;

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
			console.log('onUpdated:'+tab.url); // 切り替わったタブのURL
			if(tab.url.startsWith('http://') ||tab.url.startsWith('https://')){
				chrome.scripting.executeScript({
					target: { tabId: tab.id },
					function: enumerateImages
				});
			}
		} catch(e){}
	}
   //chrome.tabs.remove(tabId); // 更新されたタブのidを削除
});

// タブが切り替わった時のイベント
chrome.tabs.onActivated.addListener(function (tabId) {
    chrome.tabs.query({"active": true,lastFocusedWindow: true}, function (tab) {
		try{
			console.log("onActivated:"+tab[0].url); // 切り替わったタブのURL
			if(tab[0].url.startsWith('http://') ||tab[0].url.startsWith('https://')){
				chrome.scripting.executeScript({
					target: { tabId: tab[0].id },
					function: enumerateImages
				});
			}
		}catch(e){console.log(0)}
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
					function: enumerateImages
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