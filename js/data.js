/* =========================================================
   data.js  -  LINQ
   - CSV(./data/linq_topics.csv) の取得と解析
   - fetch 失敗時（APK / file:// 実行時など）は埋め込みデータへ自動フォールバック
   - localStorage による永続化（お題 / 設定 / プレイヤー / 履歴）
   - 役職配分・得点ルールの計算
   ========================================================= */
(function (global) {
  'use strict';

  var LS = {
    topics: 'linq.topics.v1',
    settings: 'linq.settings.v1',
    players: 'linq.players.v1',
    history: 'linq.history.v1',
    meta: 'linq.meta.v1'
  };

  /* ---------------------------------------------------------
     埋め込みフォールバックデータ
     （data/linq_topics.csv と同一内容。fetch できない環境用）
     tools/embed_csv.py で再生成できます
     --------------------------------------------------------- */
  var EMBEDDED_CSV = [
    'No.,お題',
    '1,犬',
    '2,猫',
    '3,ライオン',
    '4,カブトムシ',
    '5,人間',
    '6,ゾウ',
    '7,蛇',
    '8,鳥',
    '9,カエル',
    '10,ウサギ',
    '11,ウマ',
    '12,ウシ',
    '13,ブタ',
    '14,ヒツジ',
    '15,ヤギ',
    '16,ニワトリ',
    '17,ネズミ',
    '18,サル',
    '19,クマ',
    '20,シカ',
    '21,キツネ',
    '22,タヌキ',
    '23,リス',
    '24,トラ',
    '25,カメ',
    '26,コウモリ',
    '27,虫',
    '28,セミ',
    '29,トンボ',
    '30,バッタ',
    '31,カマキリ',
    '32,アリ',
    '33,ハチ',
    '34,クモ',
    '35,ゴキブリ',
    '36,テントウムシ',
    '37,ホタル',
    '38,ダンゴムシ',
    '39,クジラ',
    '40,サメ',
    '41,タコ',
    '42,イカ',
    '43,カニ',
    '44,エビ',
    '45,クラゲ',
    '46,貝',
    '47,ヒトデ',
    '48,ウニ',
    '49,空',
    '50,雷',
    '51,川',
    '52,海',
    '53,陸',
    '54,雨',
    '55,雪',
    '56,虹',
    '57,信号機',
    '58,電気',
    '59,水道',
    '60,道路',
    '61,ガス',
    '62,電柱',
    '63,橋',
    '64,トンネル',
    '65,ティッシュペーパー',
    '66,トイレ',
    '67,ベッド',
    '68,枕',
    '69,タオル',
    '70,歯ブラシ',
    '71,傘',
    '72,ゴミ箱',
    '73,帽子',
    '74,ジャケット',
    '75,イヤリング',
    '76,靴下',
    '77,マスク',
    '78,靴',
    '79,ネクタイ',
    '80,指輪',
    '81,電子レンジ',
    '82,炊飯器',
    '83,冷蔵庫',
    '84,エアコン',
    '85,アイロン',
    '86,テレビ',
    '87,洗濯機',
    '88,掃除機',
    '89,椅子',
    '90,テーブル',
    '91,ソファー',
    '92,鏡',
    '93,タンス',
    '94,本棚',
    '95,カーテン',
    '96,机',
    '97,フライパン',
    '98,まな板',
    '99,包丁',
    '100,スプーン',
    '101,フォーク',
    '102,箸',
    '103,お玉',
    '104,やかん',
    '105,ペン',
    '106,消しゴム',
    '107,鉛筆',
    '108,ハサミ',
    '109,クレヨン',
    '110,定規',
    '111,ノート',
    '112,ホッチキス',
    '113,リンゴ',
    '114,魚',
    '115,牛肉',
    '116,カボチャ',
    '117,きのこ',
    '118,卵',
    '119,パン',
    '120,いちご',
    '121,米',
    '122,和食',
    '123,中華料理',
    '124,洋食',
    '125,鍋料理',
    '126,味噌汁',
    '127,焼き肉',
    '128,天ぷら',
    '129,弁当',
    '130,プール',
    '131,黒板',
    '132,裁縫セット',
    '133,絵の具',
    '134,リコーダー',
    '135,図書室',
    '136,給食',
    '137,ランドセル',
    '138,ピアノ',
    '139,ギター',
    '140,ドラム',
    '141,マイク',
    '142,タンバリン',
    '143,バイオリン',
    '144,トランペット',
    '145,太鼓',
    '146,口',
    '147,頭',
    '148,足',
    '149,心臓',
    '150,髪の毛',
    '151,目',
    '152,耳',
    '153,歯',
    '154,車',
    '155,電車',
    '156,救急車',
    '157,飛行機',
    '158,ヘリコプター',
    '159,戦車',
    '160,自転車',
    '161,船',
    '162,パソコン',
    '163,スマートフォン',
    '164,充電器',
    '165,ゲーム機',
    '166,リモコン',
    '167,カメラ',
    '168,プリンター',
    '169,タブレット',
    '170,銃',
    '171,剣',
    '172,斧',
    '173,バール',
    '174,手榴弾',
    '175,チェーンソー',
    '176,弓矢',
    '177,爆弾',
    '178,警察',
    '179,スポーツ選手',
    '180,歌手',
    '181,大工',
    '182,美容師',
    '183,医者',
    '184,消防士',
    '185,パイロット',
    '186,警察署',
    '187,スーパー',
    '188,デパート',
    '189,駅',
    '190,図書館',
    '191,監獄',
    '192,病院',
    '193,空港',
    '194,サービスエリア',
    '195,テーマパーク',
    '196,公園',
    '197,温泉',
    '198,砂漠',
    '199,島',
    '200,宇宙',
    '201,森',
    '202,日本',
    '203,たばこ',
    '204,ビール',
    '205,コーヒー',
    '206,緑茶',
    '207,ケーキ',
    '208,ワイン',
    '209,チョコレート',
    '210,アイスクリーム',
    '211,塩',
    '212,しょうゆ',
    '213,マヨネーズ',
    '214,七味',
    '215,からし',
    '216,砂糖',
    '217,ケチャップ',
    '218,わさび',
    '219,バスケットボール',
    '220,野球',
    '221,テニス',
    '222,スケート',
    '223,スキー',
    '224,サッカー',
    '225,卓球',
    '226,水泳',
    '227,マラソン選手',
    '228,警察官',
    '229,天気予報士',
    '230,看護師',
    '231,自衛隊',
    '232,アイドル',
    '233,社長',
    '234,赤ちゃん',
    '235,学校',
    '236,会社',
    '237,裁判所',
    '238,スポーツチーム',
    '239,大学',
    '240,消防署',
    '241,爪切り',
    '242,アルコール消毒',
    '243,絆創膏',
    '244,ウェットティッシュ',
    '245,綿棒',
    '246,体温計',
    '247,包帯',
    '248,ハンドソープ',
    '249,アニメ',
    '250,漫画',
    '251,アーティスト',
    '252,お笑い芸人',
    '253,ダンス',
    '254,ドラマ',
    '255,映画',
    '256,音楽',
    '257,HIPHOP',
    '258,バンド',
    '259,青春',
    '260,バトル',
    '261,ミステリー',
    '262,コメディ',
    '263,ホラー',
    '264,ファンタジー',
    '265,イヤホン',
    '266,ヘッドフォン',
    '267,トランプ',
    '268,携帯ゲーム機',
    '269,ワックス',
    '270,キーホルダー',
    '271,眼鏡',
    '272,鍵',
    '273,動画',
    '274,雑誌',
    '275,DVD',
    '276,SNS',
    '277,本',
    '278,通販',
    '279,ニュース',
    '280,ラジオ',
    '281,白',
    '282,赤',
    '283,青',
    '284,黒',
    '285,黄色',
    '286,緑',
    '287,ピンク',
    '288,金色',
    '289,ペットボトル',
    '290,アルミ缶',
    '291,紙コップ',
    '292,ビン',
    '293,ダンボール',
    '294,水筒',
    '295,タッパー',
    '296,袋',
    '297,地震',
    '298,津波',
    '299,雪崩',
    '300,火事',
    '301,病気',
    '302,洪水',
    '303,噴火',
    '304,停電',
    '305,スコップ',
    '306,種',
    '307,庭',
    '308,土',
    '309,盆栽',
    '310,じょうろ',
    '311,肥料',
    '312,花壇',
    '313,月曜日',
    '314,火曜日',
    '315,水曜日',
    '316,木曜日',
    '317,金曜日',
    '318,土曜日',
    '319,日曜日',
    '320,月',
    '321,太陽',
    '322,惑星',
    '323,星',
    '324,雲',
    '325,地球',
    '326,流れ星',
    '327,ブラックホール',
    '328,カラオケ',
    '329,ボウリング',
    '330,ダーツ',
    '331,ネットカフェ',
    '332,居酒屋',
    '333,ゲームセンター',
    '334,映画館',
    '335,水族館',
    '336,昭和',
    '337,平成',
    '338,令和',
    '339,江戸時代',
    '340,明治時代',
    '341,縄文時代',
    '342,戦国武将',
    '343,侍',
    '344,忍者',
    '345,三国志',
    '346,刀',
    '347,手裏剣',
    '348,巻物',
    '349,鎧',
    '350,オオクワガタ',
    '351,チワワ',
    '352,オオカミ',
    '353,スズメバチ',
    '354,マグロ',
    '355,イルカ',
    '356,パンダ',
    '357,ペンギン',
    '358,キリン',
    '359,カンガルー',
    '360,コアラ',
    '361,柴犬',
    '362,ハムスター',
    '363,ゴリラ',
    '364,カバ',
    '365,シマウマ',
    '366,ワニ',
    '367,ラクダ',
    '368,ナマケモノ',
    '369,アルパカ',
    '370,アゲハチョウ',
    '371,ミツバチ',
    '372,カタツムリ',
    '373,ウミガメ',
    '374,ラッコ',
    '375,金魚',
    '376,コーラ',
    '377,ドクターペッパー',
    '378,ポカリスエット',
    '379,アクエリアス',
    '380,カルピス',
    '381,オロナミンC',
    '382,午後の紅茶',
    '383,エナジードリンク',
    '384,ファンタ',
    '385,三ツ矢サイダー',
    '386,リポビタンD',
    '387,ディズニーランド',
    '388,ユニバーサル・スタジオ・ジャパン(USJ)',
    '389,東京タワー',
    '390,富士山',
    '391,金閣寺',
    '392,東京スカイツリー',
    '393,大阪',
    '394,京都',
    '395,北海道',
    '396,沖縄',
    '397,東京',
    '398,ハワイ',
    '399,アメリカ',
    '400,大谷翔平',
    '401,木村拓哉',
    '402,櫻井翔',
    '403,マイケル・ジャクソン',
    '404,明石家さんま',
    '405,ダウンタウン',
    '406,ビートたけし',
    '407,イチロー',
    '408,羽生結弦',
    '409,タモリ',
    '410,米津玄師',
    '411,あいみょん',
    '412,さくら',
    '413,バラ',
    '414,ひまわり',
    '415,チューリップ',
    '416,竹',
    '417,紅葉',
    '418,たんぽぽ',
    '419,サボテン',
    '420,マリオ',
    '421,ポケットモンスター',
    '422,ドラゴンクエスト',
    '423,ゼルダの伝説',
    '424,星のカービィ',
    '425,桃太郎電鉄',
    '426,ファイナルファンタジー',
    '427,大乱闘スマッシュブラザーズ',
    '428,テトリス',
    '429,すごろく',
    '430,ピカチュウ',
    '431,ルイージ',
    '432,モンキー・D・ルフィ',
    '433,孫悟空',
    '434,ミッキーマウス',
    '435,ドラえもん',
    '436,アンパンマン',
    '437,クレヨンしんちゃん',
    '438,ハローキティ',
    '439,スヌーピー',
    '440,サザエさん',
    '441,くまのプーさん',
    '442,ワンピース',
    '443,ナルト',
    '444,ドラゴンボール',
    '445,鬼滅の刃',
    '446,進撃の巨人',
    '447,名探偵コナン',
    '448,ちびまる子ちゃん',
    '449,美少女戦士セーラームーン',
    '450,ガンダム',
    '451,プリキュア',
    '452,君の名は。',
    '453,となりのトトロ',
    '454,スタジオジブリ',
    '455,MARVEL(マーベル)',
    '456,ディズニー',
    '457,ハリー・ポッター',
    '458,スター・ウォーズ',
    '459,ジュラシック・パーク',
    '460,千と千尋の神隠し',
    '461,ゴジラ',
    '462,ピクサー',
    '463,少年ジャンプ',
    '464,少女漫画',
    '465,コロコロコミック',
    '466,四コマ漫画',
    '467,スラムダンク',
    '468,ブラック・ジャック',
    '469,マクドナルド',
    '470,ケンタッキーフライドチキン',
    '471,牛丼屋',
    '472,回転寿司',
    '473,ファミレス',
    '474,スターバックス',
    '475,サイゼリヤ',
    '476,モスバーガー',
    '477,ミスタードーナツ',
    '478,喫茶店',
    '479,コンビニ',
    '480,ガソリンスタンド',
    '481,競馬場',
    '482,カジノ',
    '483,運動場',
    '484,スタジアム',
    '485,パチンコ店',
    '486,東京ドーム',
    '487,高速道路',
    '488,ショッピングモール',
    '489,銭湯',
    '490,交番',
    '491,織田信長',
    '492,ペリー',
    '493,坂本龍馬',
    '494,福沢諭吉',
    '495,徳川家康',
    '496,聖徳太子',
    '497,エジソン',
    '498,ラーメン',
    '499,カレーライス',
    '500,カツ丼',
    '501,おでん',
    '502,そうめん',
    '503,そば',
    '504,うどん',
    '505,生姜焼き定食',
    '506,おにぎり',
    '507,鮭',
    '508,寿司',
    '509,ハンバーグ',
    '510,ソニー',
    '511,任天堂',
    '512,トヨタ自動車',
    '513,ユニクロ',
    '514,Google',
    '515,Amazon',
    '516,YouTube',
    '517,LINE',
    '518,ニトリ',
    '519,ダイソー',
    '520,セブンイレブン',
    '521,インスタント食品',
    '522,レトルト食品',
    '523,缶詰',
    '524,カップラーメン',
    '525,冷凍食品',
    '526,ポッキー',
    '527,きのこの山',
    '528,ガリガリ君',
    '529,うまい棒',
    '530,ハッピーターン',
    '531,プリン',
    '532,ヨーグルト',
    '533,納豆'
  ].join('\n');

  /* ------------------------- CSV ------------------------- */
  function parseCSV(text) {
    var rows = [], row = [], field = '', inQuote = false, i, c, n;
    text = String(text).replace(/^﻿/, ''); // BOM除去
    for (i = 0; i < text.length; i++) {
      c = text[i]; n = text[i + 1];
      if (inQuote) {
        if (c === '"' && n === '"') { field += '"'; i++; }
        else if (c === '"') { inQuote = false; }
        else { field += c; }
      } else {
        if (c === '"') { inQuote = true; }
        else if (c === ',') { row.push(field); field = ''; }
        else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
        else if (c === '\r') { /* skip */ }
        else { field += c; }
      }
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (v) { return String(v).trim() !== ''; }); });
  }

  /* CSV行 → お題オブジェクト配列（A列=No. / B列=お題 のみ使用） */
  function rowsToTopics(rows) {
    var out = [], start = 0;
    if (rows.length && (/no/i.test(String(rows[0][0] || '')) || isNaN(parseInt(rows[0][0], 10)))) start = 1;
    for (var i = start; i < rows.length; i++) {
      var r = rows[i];
      var text = String(r[1] == null ? '' : r[1]).trim();
      if (!text) continue;
      var no = parseInt(r[0], 10);
      if (isNaN(no)) no = i;
      out.push({
        uid: 'm' + no,
        no: no,
        text: text,
        master: true,
        fav: false,
        ex: false,
        used: false
      });
    }
    return out;
  }

  /* ------------------------- localStorage ------------------------- */
  function lsGet(key, fallback) {
    try {
      var raw = global.localStorage.getItem(key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch (e) { return fallback; }
  }
  function lsSet(key, value) {
    try { global.localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }

  var SETTINGS_VERSION = 1;
  var DEFAULT_SETTINGS = {
    excludeUsed: true,      // 使用したお題を除外する
    favoriteOnly: false,    // お気に入りからランダムに選ぶ
    useExclusion: false,    // お題の除外を有効化
    theme: 'dark',          // 'dark' | 'light'
    targetPoints: 10,       // フルゲームの勝利に必要なポイント
    suddenDeath: true,      // サドンデス
    orderQuick: 'random',   // クイック：'random' | 'manual'
    orderFull: 'shift',     // フル：'shift' | 'randomFirst' | 'randomNoDup' | 'randomDup'
    __v: SETTINGS_VERSION
  };

  var APP_VERSION = '1.2.0';

  /* お題データを差し替えたら上げる。値が変わると保存済みのお気に入り／除外／
     使用済みと履歴をリセットする（No. がずれて別のお題に紐づくのを防ぐため） */
  var TOPICS_REV = 2;

  /* Androidアプリ（APK）の配布設定
     path : 配布ファイルの場所（相対パス）
     mode : 'auto' … 実際にファイルがあるときだけタイトル画面に導線を出す（推奨）
            'on'   … 常に出す / 'off' … 出さない */
  var APK = {
    dir: './download/',
    info: './download/apk-info.json',   // ビルドの GitHub Actions が更新します
    path: './download/linq.apk',
    mode: 'auto'
  };

  /* ------------------------- 役職配分・得点ルール ------------------------- */
  /* 4〜8人：スパイ2 / 9〜12人：スパイ3 / 13〜16人：スパイ4 / 17〜20人：スパイ5 */
  function spyCountFor(n) {
    n = Math.max(4, Math.min(20, n | 0));
    if (n <= 8) return 2;
    if (n <= 12) return 3;
    if (n <= 16) return 4;
    return 5;
  }

  function rulesFor(n) {
    n = Math.max(4, Math.min(20, n | 0));
    var spies = spyCountFor(n);
    return {
      players: n,
      spies: spies,
      citizens: n - spies,
      partnerPt: 1,            // 相方（他のスパイ）を当てた
      namedCap: spies - 1,     // 他のスパイから指名された分の上限（＝スパイ数−1）
      penaltyVotes: spies,     // 一般人からこの票数以上でその回のスパイ得点が0
      citizenPt: 2,            // 一般人：2人ともスパイ的中
      expectedVotes: spies * 1 + (n - spies) * 2
    };
  }

  /* ラウンド得点の計算
     roles  : ['spy'|'citizen', ...]（プレイヤーindex順）
     votes  : [[targetIndex, ...], ...]（プレイヤーindex順 / スパイ1人・一般人2人）
     戻り値 : { points:[], received:[], fromCitizens:[], penalized:[], rescue:bool } */
  function scoreRound(roles, votes) {
    var n = roles.length;
    var r = rulesFor(n);
    var points = [], received = [], fromCitizens = [], penalized = [];
    var i, j;
    for (i = 0; i < n; i++) { points.push(0); received.push(0); fromCitizens.push(0); penalized.push(false); }

    // 得票の集計
    for (i = 0; i < n; i++) {
      var v = votes[i] || [];
      for (j = 0; j < v.length; j++) {
        var t = v[j];
        if (t == null || t < 0 || t >= n || t === i) continue;
        received[t]++;
        if (roles[i] === 'citizen') fromCitizens[t]++;
      }
    }

    for (i = 0; i < n; i++) {
      if (roles[i] === 'spy') {
        var p = 0;
        var mine = votes[i] || [];
        // 相方（自分以外のスパイ）を当てた
        for (j = 0; j < mine.length; j++) {
          if (mine[j] != null && mine[j] !== i && roles[mine[j]] === 'spy') { p += r.partnerPt; break; }
        }
        // 他のスパイから指名された数（上限：スパイ数−1）
        var named = 0;
        for (j = 0; j < n; j++) {
          if (j === i || roles[j] !== 'spy') continue;
          var vj = votes[j] || [];
          if (vj.indexOf(i) > -1) named++;
        }
        p += Math.min(named, r.namedCap);
        // ペナルティ：一般人からの得票が規定数以上なら0
        if (fromCitizens[i] >= r.penaltyVotes) { p = 0; penalized[i] = true; }
        points[i] = p;
      } else {
        var mv = (votes[i] || []).filter(function (x) { return x != null && x !== i; });
        var uniq = [];
        mv.forEach(function (x) { if (uniq.indexOf(x) < 0) uniq.push(x); });
        var hit = 0;
        uniq.forEach(function (x) { if (roles[x] === 'spy') hit++; });
        points[i] = (uniq.length === 2 && hit === 2) ? r.citizenPt : 0;
      }
    }

    // 救済ルール：誰もポイントを獲得できなかった場合、一般人全員に1pt
    var rescue = points.every(function (p) { return p === 0; });
    if (rescue) {
      for (i = 0; i < n; i++) if (roles[i] === 'citizen') points[i] = 1;
    }
    return { points: points, received: received, fromCitizens: fromCitizens, penalized: penalized, rescue: rescue };
  }

  /* ------------------------- ストア ------------------------- */
  var Store = {
    version: APP_VERSION,
    apk: APK,
    topics: [],
    settings: Object.assign({}, DEFAULT_SETTINGS),
    players: { count: 4, names: ['', '', '', ''], points: [0, 0, 0, 0] },
    history: [],
    csvLoaded: false,
    csvSource: 'none',
    repaired: 0,
    topicsReset: false,

    init: function () {
      var self = this;
      var savedSettings = lsGet(LS.settings, null) || {};
      self.settings = Object.assign({}, DEFAULT_SETTINGS, savedSettings);
      self.settings.__v = SETTINGS_VERSION;

      var sp = lsGet(LS.players, null) || {};
      self.players = {
        count: Math.max(4, Math.min(20, sp.count || 4)),
        names: Array.isArray(sp.names) ? sp.names.slice() : [],
        points: Array.isArray(sp.points) ? sp.points.slice() : []
      };
      self.setPlayerCount(self.players.count);

      var meta = lsGet(LS.meta, null) || {};
      var revChanged = (meta.topicsRev !== TOPICS_REV);
      self.history = lsGet(LS.history, []) || [];
      var saved = lsGet(LS.topics, null);
      if (revChanged) {
        // お題データが差し替わったので、お題に紐づく保存状態をリセットする
        saved = null;
        self.history = [];
        lsSet(LS.history, self.history);
        lsSet(LS.meta, { topicsRev: TOPICS_REV });
        self.topicsReset = true;
      }

      return self._loadMaster().then(function (master) {
        self.topics = self._merge(master, saved);
        self.repaired = self.syncUsedFromHistory();
        self.saveTopics();
        return self;
      });
    },

    _loadMaster: function () {
      var self = this;
      return new Promise(function (resolve) {
        var done = false;
        var fallback = function (reason) {
          if (done) return; done = true;
          self.csvSource = 'embedded(' + reason + ')';
          resolve(rowsToTopics(parseCSV(EMBEDDED_CSV)));
        };
        if (global.location && global.location.protocol === 'file:') { fallback('file-protocol'); return; }
        var timer = setTimeout(function () { fallback('timeout'); }, 4000);
        try {
          fetch('./data/linq_topics.csv', { cache: 'no-cache' })
            .then(function (res) {
              if (!res.ok) throw new Error('HTTP ' + res.status);
              return res.text();
            })
            .then(function (txt) {
              if (done) return;
              clearTimeout(timer);
              var list = rowsToTopics(parseCSV(txt));
              if (!list.length) throw new Error('empty csv');
              done = true;
              self.csvLoaded = true;
              self.csvSource = 'csv';
              resolve(list);
            })
            .catch(function () { clearTimeout(timer); fallback('fetch-error'); });
        } catch (e) { clearTimeout(timer); fallback('exception'); }
      });
    },

    _merge: function (master, saved) {
      if (!saved || !saved.length) return master.slice();
      var byUid = {};
      saved.forEach(function (t) { if (t && t.uid) byUid[t.uid] = t; });
      var merged = [];
      master.forEach(function (m) {
        var s = byUid[m.uid];
        if (s) {
          merged.push({
            uid: m.uid,
            no: (typeof s.no === 'number') ? s.no : m.no,
            text: m.text, master: true,
            fav: !!s.fav, ex: !!s.ex, used: !!s.used
          });
          delete byUid[m.uid];
        } else merged.push(m);
      });
      saved.forEach(function (s) {
        if (s && s.uid && byUid[s.uid] && !s.master) {
          merged.push({
            uid: s.uid, no: s.no, text: s.text, master: false,
            fav: !!s.fav, ex: !!s.ex, used: !!s.used
          });
        }
      });
      merged.sort(function (a, b) { return a.no - b.no; });
      return merged;
    },

    /* ------------------------- 保存 ------------------------- */
    saveTopics: function () { return lsSet(LS.topics, this.topics); },
    saveSettings: function () { return lsSet(LS.settings, this.settings); },
    savePlayers: function () { return lsSet(LS.players, this.players); },
    saveHistory: function () { return lsSet(LS.history, this.history); },
    flush: function () { this.saveTopics(); this.saveHistory(); this.saveSettings(); this.savePlayers(); },

    /* ------------------------- お題操作 ------------------------- */
    byUid: function (uid) {
      for (var i = 0; i < this.topics.length; i++) if (this.topics[i].uid === uid) return this.topics[i];
      return null;
    },
    nextNo: function () {
      var max = 0;
      this.topics.forEach(function (t) { if (t.no > max) max = t.no; });
      return max + 1;
    },
    addTopic: function (text) {
      var t = {
        uid: 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        no: this.nextNo(),
        text: String(text).trim(),
        master: false, fav: false, ex: false, used: false
      };
      this.topics.push(t);
      this.saveTopics();
      return t;
    },
    updateTopic: function (uid, text) {
      var t = this.byUid(uid);
      if (!t || t.master) return false;
      t.text = String(text).trim();
      this.saveTopics();
      return true;
    },
    deleteTopics: function (uids) {
      var set = {};
      uids.forEach(function (u) { set[u] = true; });
      this.topics = this.topics.filter(function (t) { return !(set[t.uid] && !t.master); });
      this.renumber();
      this.saveTopics();
    },
    renumber: function () {
      this.topics.sort(function (a, b) { return a.no - b.no; });
      this.topics.forEach(function (t, i) { t.no = i + 1; });
    },
    toggleFav: function (uid) { var t = this.byUid(uid); if (!t) return; t.fav = !t.fav; this.saveTopics(); },
    toggleEx: function (uid) { var t = this.byUid(uid); if (!t) return; t.ex = !t.ex; this.saveTopics(); },

    pool: function () {
      var s = this.settings;
      return this.topics.filter(function (t) {
        if (s.useExclusion && t.ex) return false;
        if (s.excludeUsed && t.used) return false;
        if (s.favoriteOnly && !t.fav) return false;
        return true;
      });
    },

    /* お題を1件ランダム抽出 */
    drawOne: function () {
      var pool = this.pool();
      var relaxed = false;
      if (!pool.length) { pool = this.topics.slice(); relaxed = true; }
      if (!pool.length) return null;
      var t = pool[Math.floor(Math.random() * pool.length)];
      return { topic: t, relaxed: relaxed, poolSize: pool.length };
    },

    markUsed: function (uid) {
      var t = this.byUid(uid);
      if (!t) return false;
      this.history.push({ uid: t.uid, no: t.no, text: t.text, ts: Date.now() });
      if (this.history.length > 500) this.history = this.history.slice(-500);
      if (!this.saveHistory()) { this.history.pop(); return false; }
      t.used = true;
      this.saveTopics();
      return true;
    },
    syncUsedFromHistory: function () {
      var inHistory = {};
      this.history.forEach(function (h) { if (h && h.uid) inHistory[h.uid] = true; });
      var changed = 0;
      this.topics.forEach(function (t) {
        var should = !!inHistory[t.uid];
        if (t.used !== should) { t.used = should; changed++; }
      });
      if (changed) this.saveTopics();
      return changed;
    },
    deleteHistory: function (ids) {
      var set = {};
      ids.forEach(function (i) { set[i] = true; });
      var removed = [];
      this.history = this.history.filter(function (h, i) {
        if (set[String(h.ts) + '_' + i]) { removed.push(h); return false; }
        return true;
      });
      this.saveHistory();
      this.syncUsedFromHistory();
      return removed;
    },
    clearHistory: function () {
      var removed = this.history.slice();
      this.history = [];
      this.saveHistory();
      this.syncUsedFromHistory();
      return removed;
    },
    restoreHistory: function (entries) {
      if (!entries || !entries.length) return;
      var self = this;
      entries.forEach(function (h) { self.history.push(h); });
      this.history.sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); });
      this.saveHistory();
      this.syncUsedFromHistory();
    },
    resetUsed: function () {
      this.topics.forEach(function (t) { t.used = false; });
      this.saveTopics();
    },

    /* ------------------------- プレイヤー ------------------------- */
    playerNames: function () {
      var out = [], n = this.players.count;
      for (var i = 0; i < n; i++) {
        var nm = (this.players.names[i] || '').trim();
        out.push(nm || ('プレイヤー' + (i + 1)));
      }
      return out;
    },
    setPlayerCount: function (n) {
      n = Math.max(4, Math.min(20, n | 0 || 4));
      this.players.count = n;
      while (this.players.names.length < n) this.players.names.push('');
      while (this.players.points.length < n) this.players.points.push(0);
      if (this.players.names.length > n) this.players.names.length = n;
      if (this.players.points.length > n) this.players.points.length = n;
      this.savePlayers();
    },
    setPlayerName: function (i, name) { this.players.names[i] = name; this.savePlayers(); },
    setPlayerPoint: function (i, pt) { this.players.points[i] = pt; this.savePlayers(); },
    resetPoints: function () {
      for (var i = 0; i < this.players.points.length; i++) this.players.points[i] = 0;
      this.savePlayers();
    },

    /* ------------------------- ルール ------------------------- */
    spyCountFor: spyCountFor,
    rulesFor: rulesFor,
    scoreRound: scoreRound,
    parseCSV: parseCSV
  };

  global.LinqStore = Store;
})(window);
