# songseek

## migu.cn 音乐爬取分析
> host: http://m.music.migu.cn/music-h5/
### 搜索歌曲
* URL: `search/searchAll.json`
* 请求方式: `GET`
* 参数:
```javascript
{
  keyWord: '歌曲名',
  type: 'song',
  pageNo: 1
  pageSize: 20
}
```
* 响应
```javascript
{
  data: {
    count: 20,
    list: [{
      crbtCopyrightId: "",
      fullSongCopyrightId: "633984098IR",
      id: "4419123",
      mvCopyrightId: "",
      ringToneCopyrightId: "",
      singerName: "高进,小沈阳",
      songId: "4419123",
      songName: "我的好兄弟",
      // 可以用于获取 mp3
      walkmanCopyrightId: ""
    }]
  },
  resultCode: '200',
  resultDesc: '成功'
}
```

### 获取歌曲信息
* URL: `/player/findSong.json`
* 请求方式: `GET`
* 参数:
```javascript
{
  copyrightId: '64394700004'
}
```
* 响应:
```javascript
{
  data: {
    songId: "1002196332",
    songName: "我的好兄弟",
    singerName: "嘉懿,洪立",
    copyrightId: "64394700004",
    mvCopyrightId: null,
    mp3: "http://tyst.migu.cn/public%2Fproduct01%2F2017%2F07%2F2015%E5%B9%B403%E6%9C%8817%E6%97%A5%E7%8B%AC%E7%AB%8B%E9%9F%B3%E4%B9%90%E4%BA%BA%E5%BC%95%E5%85%A5%E6%B4%AA%E7%AB%8B%E5%86%85%E5%AE%B9%E5%87%86%E5%85%A52%E9%A6%96%2F%E5%85%A8%E6%9B%B2%E8%AF%95%E5%90%AC%2FMp3_40_16_16%2F%E6%88%91%E7%9A%84%E5%A5%BD%E5%85%84%E5%BC%9F-%E6%B4%AA%E7%AB%8B%2B%E5%98%89%E6%87%BF.mp3",
    crbt: "http://tyst.migu.cn/public%2Fringmaker01%2Fdailyring%2Fkarakalupload%2F2015%2F03%2F2015%E5%B9%B403%E6%9C%8817%E6%97%A5%E7%8B%AC%E7%AB%8B%E9%9F%B3%E4%B9%90%E4%BA%BA%E5%BC%95%E5%85%A5%E6%B4%AA%E7%AB%8B%E5%86%85%E5%AE%B9%E5%87%86%E5%85%A52%E9%A6%96%2F%E5%BD%A9%E9%93%83%2F6_mp3-128kbps%2F%E6%88%91%E7%9A%84%E5%A5%BD%E5%85%84%E5%BC%9F-%E6%B4%AA%E7%AB%8B%2B%E5%98%89%E6%87%BF.mp3",
    songPic: "http://img01.12530.com/xianwang/music/newcms/cms/2018/0209/0050/AS1609230002479074.jpg",
    albumName: "我的好兄弟",
    mediumPic: "http://img01.12530.com/xianwang/music/newcms/cms/2018/0209/0050/AM1609230002474903.jpg",
    largePic: "http://img01.12530.com/xianwang/music/newcms/cms/2018/0209/0050/AL1609230002471217.jpg",
    hasCrbt: 1,
    hasRingTone: 1,
    hasFullSong: 1,
    hasWalkman: 1
  },
  resultCode: '200',
  resultDesc: '成功'
}
```




