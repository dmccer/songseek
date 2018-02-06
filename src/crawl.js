const fs = require('fs');
const path = require('path');
const url = require('url');
const axios = require('axios');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');
const log4js = require('log4js');
const beautify = require('js-beautify').js_beautify;
const queue = require('queue');
const Queue = require('better-queue');

const unpacker_filter = require('./lib/unpacker');
// const News = require('./model/news');
const Conf = require('./conf');

const PROTOCOL = 'http://';
const HOST = 'music.guqu.net';
const TARGET_URL = `${PROTOCOL}${HOST}`;

const LOG_DIR = path.resolve(__dirname, 'logs');
let appenders = ['app'];
if (process.env.NODE_ENV === 'development') {
  appenders.unshift('out');
}
log4js.configure({
  appenders: {
    app: {
      type: 'dateFile',
      filename: `logs/${Conf.log.cat}.log`,
      maxLogSize: 20480,
      backups: 10,
    },
    out: {
      type: 'console'
    }
  },
  categories: {
    default: { appenders, level: 'debug' }
  }
});
const logger = log4js.getLogger();

/**
 * 解码 html
 * @param {*} res 
 * @param {*} charset 
 */
function decodeHtml(res, charset='utf8') {
  return iconv.decode(res, charset);
}

/**
 * 默认请求头
 */
const defaultHeaders = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3202.94 Safari/537.36',
  Host: HOST,
  Referer: TARGET_URL
};

/**
 * 渗透目标站点安全防御措施，获取有效 cookie
 */
async function infiltrate() {
  logger.info('1.开始获取 JS 脚本...');
  const jsRes = await axios(TARGET_URL, {
    responseType: 'arraybuffer',
    headers: defaultHeaders,
    // proxy: {
    //   host: '61.155.164.110',
    //   port: 3128
    // },
  });
  const $ = decodeHtml(jsRes.data);
  const script = $('script').html().trim();
  if (!script) {
    logger.error('  获取 JS 脚本失败');
    
    return;
  }
  logger.info('  获取 JS 脚本成功');
  
  logger.info('2. 开始格式化 JS 脚本...');
  const tmp = path.resolve(__dirname, '__out.js');

  try {
    let out = beautify(unpacker_filter(script), { indent_size: 2 });
    out = out.replace('HXXTTKKLLPPP5();', 'module.exports = function() { return [ "wzwstemplate=" + KTKY2RBD9NHPBCIHV9ZMEQQDARSLVFDU(template.toString()), "wzwschallenge=" + KTKY2RBD9NHPBCIHV9ZMEQQDARSLVFDU(QWERTASDFGXYSF().toString()) ]; }');
    fs.writeFileSync(tmp, out, 'utf8');
    logger.info('  格式化 JS 脚本成功');
  } catch(e) {
    logger.error('  格式化 JS 脚本失败');
    
    return
  }

  logger.info('3. 开始执行 JS 脚本...');
  let cookiesFromJs;
  try {
    delete require.cache[tmp];
    cookiesFromJs = require(tmp)();
    logger.info('  执行 JS 脚本成功');
  } catch (e) {
    logger.error('  执行 JS 脚本失败');
  }
  
  logger.info('4. 组装获取 passport cookie 的 cookies...')
  const jsResCookies = formatResponseCookies(jsRes.headers['set-cookie']);
  const cookiesForGetPassportCookie = jsResCookies.concat(cookiesFromJs).join('; ');
  logger.info(`  组装 cookies 为 ${cookiesForGetPassportCookie}`);
  
  logger.info('5. 开始获取 passport cookie...');
  try {
    await axios(TARGET_URL, {
      headers: Object.assign({}, defaultHeaders, {
        Cookie: cookiesForGetPassportCookie
      }),
      maxRedirects: 0
    });
  } catch (err) {
    const responseCookies = err.response.headers['set-cookie'];
    const hasPassport = responseCookies.some((cookie) => {
      return cookie.indexOf('ccpassport=') !== -1;
    });

    if (!hasPassport) {
      logger.error('  获取 passport cookie 失败');
    }

    logger.info('  获取 passport cookie 成功');
    return formatResponseCookies(responseCookies);
  }
}

/**
 * 爬取首页新闻列表数据
 */
async function crawlHomePage() {
  logger.info('1. 获取主页面...')
  try {
    const homeRes = await axios(TARGET_URL, {
      responseType: 'arraybuffer',
      headers: Object.assign({}, defaultHeaders, {
        // Cookie: getUsefulCookies()
      }),
    });
    const homeRet = decodeHtml(homeRes.data, 'gb2312');
    const $ = cheerio.load(homeRet, {
      normalizeWhitespace: true,
      decodeEntities: false
    });

    logger.info('  主页面获取成功');

    logger.info('2. 开始分析主页面数据...');
    const $categories = $('.im_c3 dl');
    let ret = [];
    $categories.each((i, category) => {
      ret.push(analyzeCategory($(category)));
    });
    logger.info('  分析主页面数据成功');
    
    return ret;
  } catch (err) {
    logger.error(`  获取主页面失败, ${err.message}`);
  }
}

function analyzeCategory($category) {
  const $categoryLink = $category.find('.im_tm1 a');
  const url = $categoryLink.attr('href');
  const name = $categoryLink.text();

  return {
    name, url
  }
}

/**
 * 给 job 生成 id
 * @param {*} fn 
 * @param {*} id 
 */
function genIdentifiedJob(fn, id) {
  const _fn = fn;
  _fn.id = id;

  return _fn;
}

/**
 * 队列式抓取分类的分页信息
 * @param {*} list 
 */
function loadPageInfoOfCategory(list) {
  return new Promise(function (resolve, reject) {
    const q = queue();
    // 单个 job 超时时间
    q.timeout = 5000;
    // job 结果集
    let ret = [];

    list.forEach((item, index) => {
      q.push(genIdentifiedJob(function() {
        return axios(item.url, {
          responseType: 'arraybuffer',
          headers: Object.assign({}, defaultHeaders, {
            // Cookie: getUsefulCookies()
          })
        }).then((res) => {
          const html = decodeHtml(res.data, 'gb2312');
          const detail = analyzeCategoryPageInfo(html);
          ret.push(Object.assign({ index }, list[index], detail));
        });
      }, index));
    });

    q.on('success', (result, job) => {
      logger.info(`job-${job.id} 成功`);
    });

    q.on('error', (err, job) => {
      logger.error(`job-${job.id} 出错, ${err.message}`);
    });

    q.on('timeout', (next, job) => {
      logger.error(`job-${job.id} 超时`);
      next();
    });

    q.start(function (err) {
      if (err) {
        logger.error(`jobs 出错: ${err.message}`);

        reject(err);

        return;
      }

      resolve(ret);
    });
  });
}

/**
 * 分析详情页面，提取数据
 * @param {*} html 
 */
function analyzeCategoryPageInfo(html) {
  const $ = cheerio.load(html, {
    normalizeWhitespace: true,
    decodeEntities: false
  });
  const $b = $('.showpage b');
  const total = $b.eq(0).text().trim();
  const size = $b.eq(1).text().trim();

  return {
    total,
    size,
    prefix: 'List_'
  };
}

function loadMusicInfos(list) {
  return new Promise(function (resolve, reject) {
    // job 结果集
    let ret = [];
    const q = new Queue(({ url, categoryId, pageId }, cb) => {
      return axios(url, {
        responseType: 'arraybuffer',
        headers: Object.assign({}, defaultHeaders, {
          // Cookie: getUsefulCookies()
        })
      }).then((res) => {
        const html = decodeHtml(res.data, 'gb2312');
        const list = analyzeMusicInfo(html, categoryId, pageId);
        ret = ret.concat(list);
        cb(null, list);
      }).catch((err) => {
        cb(err);
      });
    }, { concurrent: 30, });

    let totalPageCount = 0;

    list.forEach((item, index) => {
      const total = parseInt(item.total);
      const size = parseInt(item.size);
      const count = Math.ceil(total / size);

      totalPageCount += count;

      for (let i = 0; i < count; i++) {
        const page = `${item.prefix}${i}.html`;
        const url = `${item.url}${i === 0 ? '' : page}`;

        q.push({
          id: `${item.name}-${index}-${i}: ${url}`,
          categoryId: item.index,
          pageId: i,
          url, 
        });
      }
    });

    q.on('task_finish', (taskId, result, stats) => {
      logger.info(`job-${taskId} 成功`);
    });

    q.on('task_failed', (taskId, err, stats) => {
      logger.error(`job-${taskId} 出错, ${err.message}`);
    });

    q.on('drain', function () {
      console.log('count: ', totalPageCount);
      resolve(ret);
    });
  });
}

function analyzeMusicInfo(html, categoryId, pageId) {
  const $ = cheerio.load(html, {
    normalizeWhitespace: true,
    decodeEntities: false
  });
  const $ul = $('.pub .c628 ul').not('.c628title');
  let ret = [];
  $ul.each(function(i, ul) {
    const $a = $(ul).find('div a');
    const author = $(ul).find('span').text();

    let href = $a.attr('href');
    let hrefSplited = href.split('/');
    const id = hrefSplited[hrefSplited.length - 1].replace('.html', '');
    const name = $a.text().split(' ')[0];

    ret.push({
      index: i,
      id,
      name,
      author,
      categoryId,
      pageId
    });
  });

  return ret;
}

function loadMusicDownloadUrl(musics) {
  return new Promise(function (resolve, reject) {
    // job 结果集
    let ret = [];
    const q = new Queue(({ url, index }, cb) => {
      return axios(url, {
        responseType: 'arraybuffer',
        headers: Object.assign({}, defaultHeaders, {
          // Cookie: getUsefulCookies()
        })
      }).then((res) => {
        const html = decodeHtml(res.data, 'gb2312');
        const download = analyzeMusicDownloadUrl(html);
        ret.push(Object.assign({}, musics[index], { download }));
        cb(null, download);
      }).catch((err) => {
        cb(err);
      });
    }, { concurrent: 30, maxRetries: 10, retryDelay: 1000 });

    musics.forEach(({ id, name }, index) => {
      const url = `http://music.guqu.net/guquplayer1.asp?Musicid=${id}&urlid=1`;
      q.push({
        id: `${name}-${id}: ${url}`,
        url, 
        index
      });
    });

    q.on('task_finish', (taskId, result, stats) => {
      logger.info(`job-${taskId} 成功`);
    });

    q.on('task_failed', (taskId, err, stats) => {
      logger.error(`job-${taskId} 出错, ${err.message}`);
    });

    q.on('drain', function () {
      resolve(ret);
    });
  });
}

function analyzeMusicDownloadUrl(html) {
  const $ = cheerio.load(html, {
    normalizeWhitespace: true,
    decodeEntities: false
  });
  return $('#MediaPlayer1 param[name="URL"]').attr('value').trim();
}

function loadMusicFile(downloads) {
  return new Promise(function (resolve, reject) {
    // job 结果集
    let ret = [];
    const q = new Queue(({ url, mid, index }, cb) => {
      return axios(url, {
        responseType:'stream'
      }).then((res) => {
        const filename = path.join(__dirname, 'download', `${mid}${path.extname(url)}`);
        res.data.pipe(fs.createWriteStream(filename));
        ret.push(Object.assign({}, downloads[index], { filename }));
        cb(null, filename);
      }).catch((err) => {
        cb(err);
      });
    }, { concurrent: 30, maxRetries: 10, retryDelay: 1000 });

    downloads.forEach(({ id, name, download }, index) => {
      q.push({
        id: `${name}-${id}: ${download}`,
        url: download, 
        mid: id,
        index
      });
    });

    q.on('task_finish', (taskId, result, stats) => {
      logger.info(`job-${taskId} 成功`);
    });

    q.on('task_failed', (taskId, err, stats) => {
      logger.error(`job-${taskId} 出错, ${err.message}`);
    });

    q.on('drain', function () {
      resolve(ret);
    });
  });
}

/**
 * 获取页面安全访问 Cookies
 */
function getUsefulCookies() {
  return __cookies;
}

/**
 * 分析 a 标签，提取数据
 * @param {*}  
 */
function parseLink($link) {
  return {
    title: $link.attr('title'),
    url: `${TARGET_URL}${$link.attr('href')}`
  };
}

/**
 * 格式化服务端设置的 Cookies，供下次请求时设置 Request 的 Cookies
 * @param {*} cookies 
 */
function formatResponseCookies(cookies) {
  return cookies.map((cookie) => {
    return cookie.replace('; path=/', '');
  });
}

let __cookies;

/**
 * 爬取主流程
 */
async function crawl() {
  try {
    // logger.info('------------ 渗透目标站点 -------------')
    // __cookies = await infiltrate();

    logger.info('------------ 抓取古曲分类列表 -------------');
    const list = await crawlHomePage();
    logger.info(`列表数据：${JSON.stringify(list)}`);

    logger.info('------------ 抓取古曲分类的分页信息 -------------');
    const categoryPageInfo = await loadPageInfoOfCategory(list);
    logger.info(`********** 成功抓取 ${categoryPageInfo.length} 条, 失败 ${list.length - categoryPageInfo.length} 条 ***********`);
    logger.info(`分页数据：${JSON.stringify(categoryPageInfo)}`);

    logger.info('------------ 抓取古曲信息 -------------');
    const musics = await loadMusicInfos(categoryPageInfo);
    fs.writeFileSync('music.json', JSON.stringify(musics));
    // logger.info(`歌曲数据：${JSON.stringify(musics)}`);

    logger.info('------------ 抓取古曲下载地址 ----------------');
    const downloads = await loadMusicDownloadUrl(musics);
    fs.writeFileSync('downloads.json', JSON.stringify(downloads));

    logger.info('------------ 抓取古曲文件 ----------------');
    const downloadDir = path.join(__dirname, 'download');
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir);
    }
    await loadMusicFile(downloads);

    // logger.info('------------ 写入数据库 -------------');
    // saveToDB(details);
  } catch (err) {
    logger.error(`抓取出错: ${err.message}`);
  }
}

/**
 * 保存爬取的数据到数据库
 * @param {*} data 
 */
function saveToDB(data) {
  if (!data || !data.length) {
    return;
  }

  const raw = data.map((detail) => {
    return {
      title: detail.title,
      url: detail.url,
      info_publ_date: detail.date,
      media: detail.media,
      tag: '新闻',
      channel: '央行'
    };
  });

  News.bulkCreate(raw)
    .then((news) => {
      const newsIds = news.map((news) => {
        return news.get('id')
      });
      
      logger.info(`写入数据库成功, ID 列表: ${newsIds.join()}`);
    }).catch((err) => {
      logger.error(`写入数据库出错: ${err.message}`);
    });
}

module.exports = crawl;