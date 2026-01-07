const path = require('path');
const fs = require('fs');
const { createRequire } = require('module');

// Определяем путь к ресурсам (в .exe это __dirname)
const appPath = __dirname;

// Если standalone не найден рядом со скриптом, пытаемся найти рядом с exe
const localServerPath = path.join(appPath, '.next', 'standalone', 'server.js');
const exeDir = path.dirname(process.execPath);
const exeServerPath = path.join(exeDir, '.next', 'standalone', 'server.js');

const serverPath = fs.existsSync(localServerPath) ? localServerPath : exeServerPath;

if (!fs.existsSync(serverPath)) {
  console.error('Error: Cannot find server.js');
  console.error('Looking in:', serverPath);
  process.exit(1);
}

// Запускаем сервер (грузим с диска).
// Важно:
// - сохраняем literal require ('./server.js'), чтобы pkg не ругался на dynamic require
// - выставляем cwd в папку с server.js (standalone ожидает статику рядом)
const serverDir = path.dirname(serverPath);
process.chdir(serverDir);
const diskRequire = createRequire(serverPath);
diskRequire('./server.js');
