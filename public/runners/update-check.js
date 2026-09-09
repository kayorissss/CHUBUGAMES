/**
 * Фоновая проверка обновлений ЧУБУГЕЙМ.
 *
 * Этот файл выполняется НЕ в браузере приложения, а в отдельном лёгком
 * JS-движке Android (@capacitor/background-runner), поэтому здесь нет ни DOM,
 * ни localStorage, ни import — только fetch, console и API Capacitor.
 * Система будит его примерно раз в час, когда приложение закрыто.
 *
 * Задача: спросить у GitHub версию последнего релиза и, если она новее
 * установленной, показать уведомление в шторке. Чтобы не долбить одним и тем
 * же каждый час, версию последнего показа храним в CapacitorKV.
 */

var REPO = 'kayorissss/CHUBUGAMES';
var TAG = 'latest';

/** «1.2.10» -> [1,2,10]; сравниваем по числам, а не строкой */
function parseVer(v) {
  return String(v || '')
    .replace(/^v/i, '')
    .split(/[.\-+]/)
    .map(function (x) { return parseInt(x, 10); })
    .filter(function (n) { return !isNaN(n); });
}

function isNewer(remote, local) {
  var a = parseVer(remote);
  var b = parseVer(local);
  var n = Math.max(a.length, b.length);
  for (var i = 0; i < n; i++) {
    var x = a[i] || 0;
    var y = b[i] || 0;
    if (x !== y) return x > y;
  }
  return false;
}

addEventListener('checkUpdate', function (resolve, reject, args) {
  try {
    var installed = '0.0.0';
    var notified = '';
    try {
      installed = CapacitorKV.get('installedVersion').value || '0.0.0';
      notified = CapacitorKV.get('notifiedVersion').value || '';
    } catch (e) {
      // ключей ещё нет — приложение не успело их записать
    }

    // Приложение ни разу не запускалось после установки плагина — молчим
    if (installed === '0.0.0') { resolve(); return; }

    fetch('https://api.github.com/repos/' + REPO + '/releases/tags/' + TAG, {
      headers: { Accept: 'application/vnd.github+json' },
    })
      .then(function (res) { return res.json(); })
      .then(function (json) {
        var body = String(json.body || '');
        var m = body.match(/version:\s*([0-9]+(?:\.[0-9]+)*)/i);
        var version = m ? m[1] : String(json.tag_name || '').replace(/^v/i, '');

        if (!version || !isNewer(version, installed)) { resolve(); return; }
        // про эту версию уже говорили
        if (notified === version) { resolve(); return; }

        CapacitorNotifications.schedule([
          {
            id: 7001,
            title: 'ЧУБУГЕЙМ ' + version,
            body: 'Вышло обновление. Открой игру, чтобы установить.',
          },
        ]);

        try { CapacitorKV.set('notifiedVersion', version); } catch (e) {}
        resolve();
      })
      .catch(function () {
        // нет сети или GitHub недоступен — это норма, просто ждём следующего раза
        resolve();
      });
  } catch (err) {
    reject(err);
  }
});

/**
 * Приложение сообщает свою версию. Записываем её в общее хранилище,
 * чтобы фоновая проверка знала, с чем сравнивать. Прямого доступа к KV
 * снаружи у плагина нет — только вот таким событием.
 */
addEventListener('setVersion', function (resolve, reject, args) {
  try {
    var v = (args && args.version) ? String(args.version) : '';
    if (v) {
      CapacitorKV.set('installedVersion', v);
      // человек обновился — забываем, о чём напоминали
      var was = '';
      try { was = CapacitorKV.get('notifiedVersion').value || ''; } catch (e) {}
      if (was && was !== v) CapacitorKV.set('notifiedVersion', '');
    }
    resolve();
  } catch (err) {
    reject(err);
  }
});
