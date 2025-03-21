function enumerateImages() {
	//タブが表示されたときのイベント
	let imgsArray=[];
	let i=0;

	//重たいので触りたくないドメイン
	const avoiddomains=[
		"localhost",
		"gmail.com",
		"amazon.com",
		"amazon.co.jp",
		"youtube.com",
		"google.com",
		"yahoo.co.jp"
	];
	try{
	console.log(`-------------:${document.domain}---------\n`);
	let avoidflag=0;
	avoiddomains.forEach(function(avoiddomain){
		if(document.domain.endsWith(avoiddomain)){
			avoidflag=1;
		}
	});

	if (avoidflag==0){
		//DOMツリーから検索
		//image情報を表示
		const imgs = document.querySelectorAll('img');
		imgs.forEach(function(img){
			if(img){
				//console.log(`img:${img.src}`);
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
		entity.site ={url:document.URL};		

		chrome.storage.local.set(entity, function() {
    		console.log('images stored');
		});

		// メッセージ送信する
		//chrome.runtime.sendMessage('YO!');
	}else{
		//検索しないリストに入っているとき
		chrome.runtime.sendMessage({badgeText: "no"});
	}
	}catch(e){
		console.log(e)
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
		} catch(e){console.log(e)}
	}
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
		}catch(e){console.log(e)}
    });
});

// ウインドウが切り替わったときのイベント
chrome.windows.onFocusChanged.addListener(function(windowId) {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, function(tabs) {
      if (!tabs || tabs.length === 0) {
        // タブが見つからなかった場合の処理
        console.log('No active tab found.');
        return;
      }
      // ここに実行したい処理を記述
      const activeTab = tabs[0];
      console.log('onFocusChanged:' + activeTab.url);
      if (activeTab.url.startsWith('http://') || activeTab.url.startsWith('https://')) {
        chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          function: enumerateImages
        });
      }
    });
  });
  

// イベントハンドラーをセットする  
chrome.runtime.onMessage.addListener((message, sender, sendResponse)=> {
	if (message.badgeText != null) {
		chrome.action.setBadgeText({
		  tabId: sender.tab.id,
		  text: message.badgeText,
		}, ()=> chrome.runtime.lastError); //ignore errors due to closed/prerendered tabs
		chrome.action.setBadgeBackgroundColor({
			color: "blue"
		}, ()=> chrome.runtime.lastError);
	}else if(message.reload != null){
		console.log('reload');
		chrome.tabs.query({"active": true,lastFocusedWindow: true}, function (tab) {
			try{
				console.log("onActivated:"+tab[0].url); // 切り替わったタブのURL
				if(tab[0].url.startsWith('http://') ||tab[0].url.startsWith('https://')){
					chrome.scripting.executeScript({
						target: { tabId: tab[0].id },
						function: enumerateImages
					});
				}
			}catch(e){console.log(e)}
		});
	}
	//sendResponseは書かないとUncaught (in promise) Error:になる
	sendResponse({ data: "Hey!" });
	return;
});
// メッセージ送信する
//chrome.runtime.sendMessage('YO!');

async function getCurrentTab() {
  let qo = {active: true, currentWindow: true};
  let [tab] = await chrome.tabs.query(qo);
  return tab;
}