/*
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('on').addEventListener('click', () => {
        alert(1)
    });
});
*/

/*
chrome.runtime.sendMessage({command: "reload" }, (response) => {
    console.log("受け取ったデータ：",response)
});

chrome.tabs.query( {active:true, currentWindow:true}, function(tabs){
    chrome.tabs.sendMessage(tabs[0].id, {command: 'reload'}, function(item){
    });
});*/


var defaults = {};
defaults.hoge = {col1: 'no data'};

chrome.storage.local.get(defaults, function(items) {
    const apikeys = document.getElementById('apikeys');
    items.hoge.apikeys.forEach(function(apikey){
        apikeys.innerHTML+=htmlEscape(apikey).replace('🥸','<u>').replace('🥳','</u>')+"<br>";
    });
    const iframes = document.getElementById('iframes');
    items.hoge.iframes.forEach(function(iframe){
        //iframes.innerHTML+=htmlEscape(iframe)+'<br>';
        iframes.innerText+=iframe;
    });
    const scripts = document.getElementById('scripts');
    items.hoge.scripts.forEach(function(script){
        //scripts.innerText+=script;
        scripts.innerHTML+=htmlEscape(script)+'<br>';

    });

});

function htmlEscape(str) {
    if (!str) return;
    return str.replace(/[<>&"'`]/g, function (match) {
        const escape = {
            '<': '&lt;',
            '>': '&gt;',
            '&': '&amp;',
            '"': '&quot;',
            "'": '&#39;',
            '`': '&#x60;'
        };
        return escape[match];
    });
}
