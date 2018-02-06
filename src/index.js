const schedule = require('node-schedule');
const crawl = require('./crawl');
const Conf = require('./conf');

/**
 * 开启计划每 5 分钟爬取一次
 */
if (process.env.NODE_ENV === 'production') {
  schedule.scheduleJob(`*/${Conf.interval} * * * *`, crawl);
  console.log(`爬虫启动成功，${Conf.interval} 分钟爬取一次`);
} else {
  crawl();
}