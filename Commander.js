const fs = require('fs');
const os = require('os');
const assert = require('assert');
const inquirer = require('inquirer');
const chalk = require('chalk');
const compressing = require('compressing');
const urllib = require('urllib');
const mzmodules = require('mz-modules');
const path = require('path');
const glob = require('globby');


module.exports = class Commander {
  constructor() {
    this.name = '测试';
    this.httpClient = urllib.create();
    this.registryUrl = 'http://npm.17zuoye.net/';
    this.sourceMap = {
      'aliyun': 'https://registry.npmmirror.com/',
      'npm': 'https://registry.npmjs.org/',
      '17zuoye': 'http://npm.17zuoye.net/'
    }
    this.locals = [];
  }

  async run() {
    await this.paramsCollect();
    const templateDir = await this.downloadTemplate()
    await this.copyTo(templateDir, path.join(process.cwd(), 'default'))
    return 123;
  }

  /**
 * 收集用户输入的信息
 */
  async paramsCollect() {
    const sources = Object.keys(this.sourceMap);
    const answers = await inquirer.prompt({
      name: 'source',
      type: 'list',
      message: '选个源吧？',
      choices: sources,
      pageSize: sources.length,
    });
    this.registryUrl = this.sourceMap[answers.source];
  }

  async getPackageInfo(pkgName) {
    await this.log(`fetching npm info of ${pkgName}`);
    try {
      const registryUrl = 'https://registry.npmmirror.com'
      const result = await this.curl(`${registryUrl}/${pkgName}/latest`, {
        dataType: 'json',
        followRedirect: true,
        maxRedirects: 5,
        timeout: 5000,
      });
      assert(result.status === 200, `npm info ${pkgName} got error: ${result.status}, ${result.data}`);
      return result.data;
    } catch (err) {
      await this.log(`error caught: ${JSON.stringify(err)}`);
    }
  }

  async curl(url, options) {
    return this.httpClient.request(url, options);
  }

  /**
 * 下载模板文件
 */
  async downloadTemplate(pkgName = 'egg-init') {
    const result = await this.getPackageInfo(pkgName, false);
    const tgzUrl = result.dist.tarball;

    await this.log(`downloading ${tgzUrl}`);

    const saveDir = path.join(os.tmpdir(), 'titan-init-boilerplate');
    await mzmodules.rimraf(saveDir);

    const response = await this.curl(tgzUrl, { streaming: true, followRedirect: true });
    await compressing.tgz.uncompress(response.res, saveDir);

    await this.log(`extract to ${saveDir}`);
    return path.join(saveDir, '/package');
  }

  /**
   * log with prefix
   */
  async log() {
    const args = Array.prototype.slice.call(arguments);
    args[0] = chalk.blue(`[${this.name}] `) + args[0];
    console.log.apply(console, args);
  }

  /**
 * 模板目录拷贝到指定目录，完全可以通过目录重命名实现，只是觉得有点意思而已
 * @param {*} fromDir 
 * @param {*} targetDir 
 */
  async copyTo(fromDir, targetDir) {
    if (fs.existsSync(targetDir)) {
      await mzmodules.rimraf(targetDir);
    }
    fs.mkdirSync(targetDir, { recursive: true })

    const files = glob.sync('**/*', {
      cwd: fromDir,
      dot: true,
      onlyFiles: false,
      followSymlinkedDirectories: false,
    });

    for (const file of files) {
      const src = fromDir;
      const from = path.join(src, file);
      const to = path.join(targetDir, file);

      const { dir: dirname, base: basename } = path.parse(to);

      fs.mkdirSync(dirname, { recursive: true })
      if (fs.lstatSync(from).isDirectory()) {
        fs.mkdirSync(to, { recursive: true })
        continue;
      }
      fs.mkdirSync(dirname, { recursive: true })
      const r = fs.createReadStream(from)
      const w = fs.createWriteStream(to)
      r.pipe(w)
    }
  }

  /**
 * 替换package.json中的初始化变量
 */
  async replaceParams() {

  }
}