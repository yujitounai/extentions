function contentDiscovery() {
	alert(document.domain)
	  var urls=[],cnt=0,org_cnt=0,thr=500,findurls=[];redirurls=[];
	  var matchword='';
	  var progress_results ,data_results,find_results;
	  var secondexts=[
		'',
		'~',
  /*      '.$$$',*/
  /*      '.~1',*/
  /*      '.~bk',*/
  /*      '.bac',*/
  /*      '.BAC',*/
  /*      '.backup',*/
  /*      '.BACKUP',*/
		'.bak',
  /*      '.BAK',*/
  /*      '.cs',*/
  /*      '.csproj',*/
		'.gz',
  /*      '.old',*/
  /*      '.OLD',*/
  /*      '.orig',*/
  /*      '.ORIG',*/
  /*      '.sav',*/
  /*      '.save',*/
		'.temp',
		'.tgz',
  /*      '.tmp',*/
  /*      '.TMP',*/
  /*      '-OLD',*/
  /*      '-old',*/
		];
	  var pages=[
		'.DS_Store',
		'.bash_history',
		'.bash_logout',
		'.bash_profile',
		'.bashrc',
		'.git',
		'.git/config',
		'.gitignore',
		'.htaccess',
		'.htpasswd',
		'.svn',
		'about',
		'aboutus',
		'access',
		'account',
		'accounts',
		'accounting',
		'addUser',
		'admin',
		'administrator',
		'administration',
		'admins',
		'adminuser',
		'ads',
		'app',
		'application',
		'apache',
		'archive',
		'archives',
		'arrow',
		'article',
		'articles',
		'at',
		'atom',
		'auth',
		'author',
		'authors',
		'autologin',
		'awstats',
		'awstats/awstats',
		'b',
		'backup',
		'backup/wp-login',
		'backups',
		'banner',
		'banners',
		'bin',
		'binary',
		'binaries',
		'blank',
		'blog',
		'blogs',
		'books',
		'business',
		'buttons',
		'calc',
		'careers',
		'catalog',
		'category',
		'ccards',
		'cert',
		'cgi-bin',
		'changepass',
		'changepasswd',
		'changepassword',
		'changepwd',
		'chgpass',
		'chgpasswd',
		'chgpassword',
		'chgpwd',
		'chpass',
		'chpasswd',
		'chpassword',
		'changepwd',
		'chpwd',
		'class',
		'client',
		'clients',
		'cmd',
		'code',
		'com',
		'comments',
		'common',
		'community',
		'comp',
		'company',
		'command',
		'conf',
		'config',
		'configs',
		'contact',
		'contactus',
		'content',
		'controlpanel',
		'copyright',
		'core',
		'crack',
		'credit',
		'crossdomain',
		'cust',
		'custom',
		'customer',
		'customers',
		'data',
		'database',
		'databases',
		'datafiles',
		'db',
		'db_conf',
		'db_config',
		'dbconf',
		'dbconfig',
		'dbconnect',
		'dbsql',
		'debug',
		'default',
		'delete',
		'demo',
		'demos',
		'dev',
		'devel',
		'development',
		'dir',
		'directories',
		'directory',
		'doc',
		'doc-html',
		'docs',
		'document',
		'documentation',
		'documents',
		'download',
		'downloads',
		'dump',
		'e',
		'education',
		'email',
		'employees',
		'en',
		'enter',
		'error',
		'errors',
		'etc',
		'events',
		'example',
		'examples',
		'exit',
		'export',
		'external',
		'extranet',
		'faq',
		'fd',
		'features',
		'feed',
		'feedback',
		'file',
		'files',
		'fileadmin',
		'find',
		'flash',
		'footer',
		'form',
		'forms',
		'forum',
		'forums',
		'force-download',
		'frame',
		'frame1',
		'frame2',
		'framemain',
		'ftp',
		'full',
		'fun',
		'function',
		'function.mysql-connect',
		'function.mysql-result',
		'g',
		'gallery',
		'games',
		'general',
		'global',
		'globals',
		'go',
		'graphics',
		'guest',
		'guests',
		'h',
		'head',
		'header',
		'help',
		'hidden',
		'history',
		'home',
		'htm',
		'html',
		'i',
		'icons',
		'iesvc/iesvc.jsp',
		'image',
		'images',
		'img',
		'imp',
		'import',
		'in',
		'inc',
		'include',
		'includes',
		'index',
		'info',
		'information',
		'inquiry',
		'install',
		'internal',
		'internet',
		'intranet',
		'inventory',
		'invoker',
		'invoker/JMXInvokerServlet',
		'isadmin',
		'j',
		'jobs',
		'js',
		'k',
		'keygen',
		'known',
		'l',
		'legal',
		'lib',
		'library',
		'links',
		'linux',
		'license',
		'licenses',
		'log',
		'logfile',
		'logfiles',
		'loginng',
		'login',
		'logo',
		'logoff',
		'logon',
		'logos',
		'logout',
		'logs',
		'm',
		'mail',
		'main',
		'mainframe',
		'man',
		'manage',
		'management',
		'manager',
		'manual',
		'map',
		'maps',
		'marketing',
		'media',
		'member',
		'members',
		'message',
		'messages',
		'messaging',
		'menu',
		'menuitem',
		'misc',
		'mod',
		'module',
		'modules',
		'music',
		'myadmin',
		'mysql',
		'mysql-inc',
		'n',
		'name',
		'names',
		'nav',
		'new',
		'news',
		'newpass',
		'newpasswd',
		'newpassword',
		'newpw',
		'news',
		'newsletter',
		'newUser',
		'notes',
		'o',
		'objects',
		'old',
		'oracle',
		'order',
		'orders',
		'out',
		'p',
		'page',
		'pages',
		'papers',
		'partner',
		'partners',
		'passport',
		'pass',
		'passwd',
		'passwd.adjunct',
		'password',
		'passwords',
		'payment',
		'pdf',
		'people',
		'personal',
		'photos',
		'phpinfo',
		'phpMyAdmin',
		'phpSQLiteAdmin',
		'pics',
		'pictures',
		'portal',
		'power_user',
		'press',
		'print',
		'products',
		'profile',
		'protected',
		'proxy',
		'privacy',
		'product',
		'products',
		'profile',
		'projects',
		'pub',
		'public',
		'publications',
		'publish',
		'purchase',
		'purchases',
		'pw',
		'pwd',
		'q',
		'r',
		'readme',
		'README',
		'redir',
		'redirect',
		'ref',
		'register',
		'relogin',
		'report',
		'reports',
		'research',
		'resources',
		'restricted',
		'retail',
		'reviews',
		'robot',
		'robots',
		'rom-0',
		'rss',
		's',
		'sales',
		'save',
		'sample',
		'script',
		'scripts',
		'search',
		'secret',
		'secure',
		'security',
		'sell',
		'serial',
		'server',
		'service',
		'services',
		'servlet',
		'servlets',
		'session',
		'setpass',
		'setpasswd',
		'setpassword',
		'setpwd',
		'setup',
		'setup/config',
		'share',
		'shared',
		'shipping',
		'shell',
		'shop',
		'show',
		'site',
		'sitemap',
		'sites',
		'soap',
		'software',
		'source',
		'spacer',
		'spam',
		'sports',
		'sql',
		'SQLiteManager',
		'src',
		'staff',
		'stat',
		'stats',
		'status',
		'store',
		'stories',
		'story',
		'stuff',
		'style',
		'styles',
		'stylesheet',
		'stylesheets',
		'submit',
		'subscribe',
		'support',
		'sun',
		'supplier',
		'suppliers',
		'supply',
		'support',
		'sys',
		'system',
		'systems',
		't',
		'tar',
		'target',
		'tech',
		'technology',
		'temp',
		'template',
		'templates',
		'term',
		'terms',
		'test',
		'testing',
		'tests',
		'themes',
		'ticket',
		'tickets',
		'tip',
		'tips',
		'tmp',
		'todo',
		'tool',
		'tools',
		'top',
		'u',
		'unknown',
		'updates',
		'upload',
		'uploads',
		'us',
		'user',
		'users',
		'usr',
		'utiles',
		'v',
		'vendor',
		'video',
		'view',
		'w',
		'warez',
		'web',
		'webadmin',
		'webalizer',
		'webdav',
		'WEB-INF/web',
		'webmail',
		'welcome',
		'wiki',
		'word',
		'wordpress',
		'world',
		'wp',
		'wp-admin',
		'wp-content',
		'wp-content/backup-db',
		'wp-content/themes',
		'wp-includes',
		'wp-login',
		'write',
		'www',
		'xampp',
		'xml',
		'zip',
		'0',
		'1',
		'2',
		'3',
		'4',
		'5',
		'6',
		'7',
		'8',
		'9',
		'2016',
		'2017',
		'2018',
		'2019',
		'2020',
		'/WEB-INF/web.xml',
		'/..3B/',
		];
	  var extensions=[
	  ];
	  var org_extlists=[
		  ['','checked'],
		  ['.asp',''],
		  ['.aspx',''],
		  ['.conf',''],
		  ['.doc',''],
		  ['.htm',''],
		  ['.html','checked'],
		  ['.inc',''],
		  ['.ini',''],
		  ['.jsp',''],
		  ['.log',''],
		  ['.pdf',''],
		  ['.php',''],
		  ['.sql',''],
		  ['.tmp',''],
		  ['.txt',''],
		  ['.xls',''],
		  ['.xlsx',''],
		  ['.xml',''],
	  ];
	  var extlists=JSON.parse(JSON.stringify(org_extlists));
	  var d = document,id = "SearchHiddenFiles",parentel = d.getElementById(id);
	  var throttle_input;
	  if (!parentel) {
		  parentel = d.createElement("div");
		  parentel.setAttribute("id", id);
		  parentel.setAttribute("style","text-align: left;position:fixed;top:10px;right:10px;padding:10px;background:#fff;font:12px/18px monospace;z-index:99999;max-height:100%;overflow:auto;border-radius:8px;border:1px solid #000");
		  parentel.style.backgroundColor="#EFECCA";
		  parentel.style.width="350px";
		  parentel.style.display="block";
		  d.body.appendChild(parentel);
		  const parenttitle = document.createElement("h2");
		  parenttitle.setAttribute("style","font:14px/18px sans-serif");
		  const parenttext = document.createTextNode("Search hidden files");
		  parenttitle.appendChild(parenttext);
		  parentel.appendChild(parenttitle);
		  parentel.addEventListener("click",handler,!1);
	  }
	  /*スタートとストップ*/
	  var switchel = document.getElementById("switch");
	  if(!switchel){
		  const switchbox = document.createElement("div");
		  const switchtext1 = document.createTextNode("switch");
		  switchbox.setAttribute("id", "switch");
		  switchbox.setAttribute("style","color: #050505;font-weight: 500;border:1px solid;background:#FFF;width:330px;margin:2pt;padding:1pt;");
		  switchbox.appendChild(switchtext1);
		  parentel.appendChild(switchbox);
  
		  const switch_start = document.createElement("a");
		  const start_text = document.createTextNode("start");
		  switch_start.setAttribute("id", "start");
		  switch_start.setAttribute("href", "#");
		  switch_start.setAttribute("style","color: #050505;font-weight:500;border:1px solid;background:#FFF;margin:2pt;padding:1pt;");
		  switch_start.appendChild(start_text);
		  switchbox.appendChild(switch_start);
  
		  const switch_stop = document.createElement("a");
		  const stop_text = document.createTextNode("stop");
		  switch_stop.setAttribute("id", "stop");
		  switch_stop.setAttribute("href", "#");
		  switch_stop.setAttribute("style","color: #050505;font-weight:500;border:1px solid;background:#FFF;margin:2pt;padding:1pt;");
		  switch_stop.appendChild(stop_text);
		  switchbox.appendChild(switch_stop);
  
		  const switch_reset = document.createElement("a");
		  const reset_text = document.createTextNode("reset");
		  switch_reset.setAttribute("id", "reset");
		  switch_reset.setAttribute("href", "#");
		  switch_reset.setAttribute("style","color: #050505;font-weight:500;border:1px solid;background:#FFF;margin:2pt;padding:1pt;");
		  switch_reset.appendChild(reset_text);
		  switchbox.appendChild(switch_reset);
  
		  const switch_close = document.createElement("a");
		  const close_text = document.createTextNode("close");
		  switch_close.setAttribute("id", "close");
		  switch_close.setAttribute("href", "#");
		  switch_close.setAttribute("style","color: #050505;font-weight:500;border:1px solid;background:#FFF;margin:2pt;padding:1pt;");
		  switch_close.appendChild(close_text);
		  switchbox.appendChild(switch_close);
	  }
	  /*設定パネル*/
  	  var configel = document.getElementById("config");
	  var extbox;
	  if(!configel){
		  const configbox = document.createElement("div");
		  const configtext1 = document.createTextNode("config");
		  configbox.setAttribute("id", "config");
		  configbox.setAttribute("style","border:1px solid;background:#FFF;width:330px;margin:2pt;padding:1pt;");
		  configbox.appendChild(configtext1);
		  parentel.appendChild(configbox);
  
		  const throttle_span = document.createElement("span");
		  const throttle_text = document.createTextNode("throttle");
		  throttle_span.setAttribute("id", "throttle");
		  throttle_span.setAttribute("style","border:1px solid;background:#FFF;margin:2pt;padding:1pt;");
		  throttle_span.appendChild(throttle_text);
		  configbox.appendChild(throttle_span);
  
		  throttle_input = document.createElement("input");
		  throttle_input.setAttribute("type","text"); 
		  throttle_input.setAttribute("maxlength","5"); 
		  throttle_input.setAttribute("size","5"); 
		  throttle_input.setAttribute("name","throttle"); 
		  throttle_input.setAttribute("value",thr);
		  throttle_input.setAttribute("style","display:inline-block;font: 12px / 18px monospace;border:1px solid;background:#FFF;width:50px;height:20px;margin:2pt;padding:1pt;");
		  configbox.appendChild(throttle_input);
  
		  const throttle_span2 = document.createElement("span");
		  const throttle_text2 = document.createTextNode("ms");
		  throttle_span2.setAttribute("style","border:1px solid;background:#FFF;margin:2pt;padding:1pt;");
		  throttle_span2.appendChild(throttle_text2);
		  configbox.appendChild(throttle_span2);
  
		  extbox = document.createElement("div");
		  const exttext1 = document.createTextNode(" ");
		  extbox.setAttribute("id", "extbox");
		  extbox.setAttribute("style","border:1px solid;background:#FFF;width:310px;margin:2pt;padding:1pt;");
		  extbox.appendChild(exttext1);
		  configbox.appendChild(extbox);
		  
		  var ext_input=[];
		  var extlabel=[];
		  for (var i = 0; i < extlists.length; i++) {
			  var checkbox = document.createElement('input');
			  var label = document.createElement('label');
			  var br = document.createElement('br');
			  var checkboxid = "checkbox" + i;
			  var labelid = "label" + i;
			  var name = "ext";
			  checkbox.setAttribute("type", "checkbox");
			  checkbox.setAttribute("value", extlists[i][0]);
			  checkbox.setAttribute("id", checkboxid);
			  checkbox.setAttribute("class", name);
			  checkbox.setAttribute("name", name);
			  checkbox.setAttribute("style","appearance: checkbox;height:10px;margin:1px;display:inline-block;font-weight:400;text-align: center;");

			  label.setAttribute("for", checkboxid);
			  label.setAttribute("id", labelid);
			  label.setAttribute("style","font: 12px/18px monospace;height:10px;margin:1px;display:inline-block;font-weight:400;text-align: center;");
			  label.innerText = extlists[i][0];
			  if(extlists[i][1] == "checked"){
				  checkbox.checked = true;
			  }else{
				  checkbox.checked = false;
			  }
			  extbox.appendChild(checkbox);
			  extbox.appendChild(label);
		  }
	  }
  
	  var resultsel = document.getElementById("results");
	  if(!resultsel){
		  const resultsbox = document.createElement("div");
		  const resultstext1 = document.createTextNode("results");
		  resultsbox.setAttribute("id", "results");
		  resultsbox.setAttribute("style","border:1px solid;background:#FFF;width:330px;margin:2pt;padding:1pt;");
		  resultsbox.appendChild(resultstext1);
		  parentel.appendChild(resultsbox);
  
		  const progressbox = document.createElement("div");
		  const progresstext1 = document.createTextNode("progress");
		  progressbox.setAttribute("id", "progress");
		  progressbox.setAttribute("style","border:1px solid;background:#FFF;width:310px;margin:2pt;padding:1pt;");
		  progressbox.appendChild(progresstext1);
		  resultsbox.appendChild(progressbox);
  
		  progress_results = document.createElement("span");
		  progress_results.setAttribute("id", "progress");
		  progress_results.setAttribute("style","border:1px solid;background:#FFF;margin:2pt;padding:1pt;");
		  progressbox.appendChild(progress_results);
  
		  const databox = document.createElement("div");
		  const datatext1 = document.createTextNode("now searching...");
		  databox.setAttribute("id", "data");
		  databox.setAttribute("style","border:1px solid;background:#FFF;width:310px;margin:2pt;padding:1pt;");
		  databox.appendChild(datatext1);
		  resultsbox.appendChild(databox);
  
		  data_results = document.createElement("div");
		  data_results.setAttribute("id", "data");
		  data_results.setAttribute("style","border:1px solid;background:#FFF;width:310px;margin:2pt;padding:1pt;");
		  resultsbox.appendChild(data_results);
  
		  const findbox = document.createElement("div");
		  const findtext1 = document.createTextNode("urls finded");
		  findbox.setAttribute("id", "find");
		  findbox.setAttribute("style","border:1px solid;background:#FFF;width:310px;margin:2pt;padding:1pt;");
		  findbox.appendChild(findtext1);
		  resultsbox.appendChild(findbox);
  
		  find_results = document.createElement("div");
		  find_results.setAttribute("id", "find");
		  find_results.setAttribute("style","border:1px solid;background:#FFF;width:310px;margin:2pt;padding:1pt;");
		  resultsbox.appendChild(find_results);
	  }
	  function handler(e, t) {
		  t=e.target;
		  e.preventDefault();
		  switch (t.id) {
			  case "start":
				  if(org_cnt>0){
					  cnt=org_cnt;
					  org_cnt=0;
				  }
				  callme();
				  break;
			  case "stop":
				  org_cnt=cnt;
				  cnt=urls.length-1;
				  break;
			  case "reset":
				  urls.length=0;
				  extensions.length=0;
				  cnt=0,org_cnt=0,thr=500,findurls=[];redirurls=[];
				  extlists=JSON.parse(JSON.stringify(org_extlists));
				  extrender();
				  buildpayloads();
				  break;
			  case "close":
				  cnt=urls.length-1;
				  parentel.style.display="none";
				  d.body.removeChild(parentel);
				  break;
		  };
		  switch (t.className) {
			  case "ext":
				  extensions.length=0;
				  buildpayloads();
				  extrender();
				  break;
		  };
	  }
  
	  extobj = document.getElementsByName('ext');
	  var url = window.location.pathname;
	  var path = url.replace(/\\/g, '/').replace(/\/[^/]*$/, '');
	  if (path.match(/^[^/]*\.[^/\.]*$/)) {
		  path = '';
	  }
	  function buildpayloads(){
		  for (var i = 0; i < extobj.length; i++) {
			  if (extobj[i].checked) {
				  extlists[i][1] = "checked";
				  extensions.push(extobj[i].value);
			  }else{
				  extlists[i][1] = "";  
			  }
		  }
		  urls.length=0;
		  for(var k in secondexts) {
		  for(var j in extensions) {
		  for(var i in pages) {
			  urls.push(location.protocol+'//'+location.host+path+'/'+pages[i]+extensions[j]+secondexts[k]);
		  } } }
		  urls.push('http://xxe.tokyo');
		  progress_results .innerText=( (org_cnt>0) ? org_cnt:cnt)+"/"+(urls.length-1);
		  data_results.innerText=urls[cnt];
		  find_results.innerText=findurls;
	  }
  
	  function extrender(){
		  for (var i = 0; i < extlists.length; i++) {
			  var checkboxid = "checkbox" + i;
			  var labelid = "label" + i;
			  var parent = document.getElementById('extbox');
			  var checkbox = document.getElementById(checkboxid);
			  var label = document.getElementById(labelid);
			  parent.removeChild(checkbox);
			  parent.removeChild(label);
		  }
		  for (var i = 0; i < extlists.length; i++) {
			  var checkbox = document.createElement('input');
			  var label = document.createElement('label');
			  var br = document.createElement('br');
			  var checkboxid = "checkbox" + i;
			  var labelid = "label" + i;
			  var name = "ext";
			  checkbox.setAttribute("type", "checkbox");
			  checkbox.setAttribute("value", extlists[i][0]);
			  checkbox.setAttribute("id", checkboxid);
			  checkbox.setAttribute("class", name);
			  checkbox.setAttribute("name", name);
			  checkbox.setAttribute("style","appearance: checkbox;height:10px;margin:1px;display:inline-block;font-weight:400;text-align: center;");

			  label.setAttribute("for", checkboxid);
			  label.setAttribute("id", labelid);
			  label.setAttribute("style","font: 12px/18px monospace;height:10px;margin:1px;display:inline-block;font-weight:400;text-align: center;");
			  label.innerText = extlists[i][0];
			  if(extlists[i][1] == "checked"){
				  checkbox.checked = true;
			  }else{
				  checkbox.checked = false;
			  }
			  extbox.appendChild(checkbox);
			  extbox.appendChild(label);
		  }
	  }
	  buildpayloads();
  
	  function callme(){
		  var networkPromise = fetch(urls[cnt],{redirect: 'manual'}).then(function(response) {
			  if(!response.ok){
				  console.log(response.status+' ng '+response.url);
				  if (response.status=='0')redirurls.push(response.url);
			  }else{
				  findurls.push(response.url);   /*エラーでも200になるときはコメントアウトたぶんチェックボックスで分岐が必要かも */
				  console.log(response.status+' yes '+response.url);
			  }
		  });
		  var timeOutPromise = new Promise(function(resolve, reject) {
		   throbj = document.getElementsByName('throttle');
		   thr=throbj[0].value;
			  setTimeout(resolve, thr, 'Timeout Done');
		  });
		  Promise.all([networkPromise, timeOutPromise]).then(function(values) {
			  console.log(urls[cnt]+":");
			  data_results.innerText=urls[cnt];
			  find_results.innerText=findurls;
			  progress_results .innerText=( (org_cnt>0) ? org_cnt:cnt)+"/"+(urls.length-1);
			  if (cnt < urls.length-1){
				  callme();
				  cnt++;
			  }else{
				  cnt=urls.length-1;
				  data_results.innerText="stopped";
			  }
		  });
	  }
  }
  


chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: contentDiscovery
  });
});

// イベントハンドラーをセットする  
chrome.runtime.onMessage.addListener(function (message) {
	console.log(message);
});
// メッセージ送信する
chrome.runtime.sendMessage('YO!');