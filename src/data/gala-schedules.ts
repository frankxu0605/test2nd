export type ProgramType =
  | "歌舞"
  | "小品"
  | "相声"
  | "魔术"
  | "杂技"
  | "武术"
  | "戏曲"
  | "朗诵"
  | "特别节目"
  | "零点钟声";

export interface ProgramItem {
  time: string;
  name: string;
  type: ProgramType;
  performers: string;
}

export interface GalaInfo {
  id: string;
  name: string;
  fullName: string;
  channel: string;
  emoji: string;
  color: string;
  programs: ProgramItem[];
}

export const galas: GalaInfo[] = [
  {
    id: "cctv",
    name: "央视春晚",
    fullName: "中央广播电视总台春节联欢晚会",
    channel: "CCTV-1 综合频道",
    emoji: "📺",
    color: "#c41e3a",
    programs: [
      { time: "20:00", name: "开场歌舞《龙马精神》", type: "歌舞", performers: "成龙、刘德华、全体演员" },
      { time: "20:15", name: "相声《马到成功》", type: "相声", performers: "岳云鹏、孙越" },
      { time: "20:30", name: "歌曲《万马奔腾》", type: "歌舞", performers: "谭维维、萧敬腾" },
      { time: "20:45", name: "小品《一马当先》", type: "小品", performers: "沈腾、马丽、艾伦" },
      { time: "21:00", name: "武术《骏马飞驰》", type: "武术", performers: "河南少林武术团" },
      { time: "21:15", name: "歌曲《策马奔腾》", type: "歌舞", performers: "凤凰传奇" },
      { time: "21:30", name: "魔术《幻马奇缘》", type: "魔术", performers: "刘谦" },
      { time: "21:50", name: "小品《老马识途》", type: "小品", performers: "贾冰、倪虹洁" },
      { time: "22:10", name: "戏曲联唱《国粹芬芳》", type: "戏曲", performers: "于魁智、李胜素、孟广禄" },
      { time: "22:30", name: "歌曲《天马行空》", type: "歌舞", performers: "周深、张韶涵" },
      { time: "22:50", name: "杂技《马上飞花》", type: "杂技", performers: "中国杂技团" },
      { time: "23:10", name: "相声《马年说马》", type: "相声", performers: "郭德纲、于谦" },
      { time: "23:30", name: "歌舞《春风得意马蹄疾》", type: "歌舞", performers: "王菲、那英" },
      { time: "23:50", name: "特别节目《致敬时代》", type: "特别节目", performers: "全体演员" },
      { time: "00:00", name: "零点钟声 · 新年倒计时", type: "零点钟声", performers: "全体" },
      { time: "00:05", name: "歌曲《难忘今宵》", type: "歌舞", performers: "李谷一、全体演员" },
    ],
  },
  {
    id: "beijing",
    name: "北京台春晚",
    fullName: "北京卫视春节联欢晚会",
    channel: "北京卫视",
    emoji: "🏮",
    color: "#dc2626",
    programs: [
      { time: "19:30", name: "开场歌舞《京城马年乐》", type: "歌舞", performers: "韩磊、谭晶" },
      { time: "19:50", name: "小品《北京的哥》", type: "小品", performers: "宋小宝、杨树林" },
      { time: "20:10", name: "歌曲《故宫以东》", type: "歌舞", performers: "毛不易" },
      { time: "20:25", name: "相声《马路笑话》", type: "相声", performers: "苗阜、王声" },
      { time: "20:45", name: "歌曲《北京欢迎你》", type: "歌舞", performers: "群星" },
      { time: "21:00", name: "小品《胡同情》", type: "小品", performers: "闫学晶、潘长江" },
      { time: "21:25", name: "魔术《京韵幻影》", type: "魔术", performers: "丁建中" },
      { time: "21:45", name: "歌曲《中国功夫》", type: "歌舞", performers: "屠洪刚" },
      { time: "22:00", name: "小品《年夜饭》", type: "小品", performers: "黄晓明、宋佳" },
      { time: "22:25", name: "戏曲《国粹京韵》", type: "戏曲", performers: "王佩瑜、史依弘" },
      { time: "22:50", name: "歌曲《我和我的祖国》", type: "歌舞", performers: "蔡国庆、佟丽娅" },
      { time: "23:10", name: "歌舞《新年快乐》", type: "歌舞", performers: "全体演员" },
    ],
  },
  {
    id: "dragon",
    name: "东方卫视春晚",
    fullName: "东方卫视春节联欢晚会",
    channel: "东方卫视",
    emoji: "🌟",
    color: "#2563eb",
    programs: [
      { time: "19:30", name: "开场秀《海上马年》", type: "歌舞", performers: "李宇春、华晨宇" },
      { time: "19:50", name: "小品《上海滩往事》", type: "小品", performers: "贾玲、张小斐" },
      { time: "20:10", name: "歌曲《夜上海》", type: "歌舞", performers: "周笔畅" },
      { time: "20:30", name: "相声《海派笑谈》", type: "相声", performers: "高晓攀、尤宪超" },
      { time: "20:50", name: "歌曲《光年之外》", type: "歌舞", performers: "邓紫棋" },
      { time: "21:10", name: "小品《快递人生》", type: "小品", performers: "常远、王宁" },
      { time: "21:30", name: "杂技《东方明珠》", type: "杂技", performers: "上海杂技团" },
      { time: "21:50", name: "歌曲《大鱼》", type: "歌舞", performers: "周深" },
      { time: "22:10", name: "小品《相亲角》", type: "小品", performers: "马丽、魏翔" },
      { time: "22:35", name: "歌曲《繁花》", type: "歌舞", performers: "胡歌、唐嫣" },
      { time: "22:55", name: "武术《太极风云》", type: "武术", performers: "上海武术队" },
      { time: "23:15", name: "歌舞《明天会更好》", type: "歌舞", performers: "全体演员" },
    ],
  },
  {
    id: "hunan",
    name: "湖南卫视春晚",
    fullName: "湖南卫视春节联欢晚会",
    channel: "湖南卫视",
    emoji: "🎤",
    color: "#ea580c",
    programs: [
      { time: "19:30", name: "开场歌舞《快乐出发》", type: "歌舞", performers: "何炅、谢娜、汪涵" },
      { time: "19:50", name: "歌曲《奔跑吧马年》", type: "歌舞", performers: "张杰" },
      { time: "20:05", name: "小品《直播翻车》", type: "小品", performers: "大张伟、沙溢" },
      { time: "20:25", name: "歌曲《不染》", type: "歌舞", performers: "毛不易" },
      { time: "20:40", name: "相声《网红进化论》", type: "相声", performers: "卢鑫、玉浩" },
      { time: "21:00", name: "歌曲《起风了》", type: "歌舞", performers: "吴青峰" },
      { time: "21:15", name: "小品《辣椒的故事》", type: "小品", performers: "宋小宝、柳岩" },
      { time: "21:40", name: "歌曲《最美的期待》", type: "歌舞", performers: "周笔畅、张碧晨" },
      { time: "21:55", name: "魔术《幻乐之城》", type: "魔术", performers: "YIF" },
      { time: "22:15", name: "小品《带娃那些事》", type: "小品", performers: "乔杉、修睿" },
      { time: "22:40", name: "歌曲《浏阳河》", type: "歌舞", performers: "张也、阿云嘎" },
      { time: "23:00", name: "歌舞《快乐中国》", type: "歌舞", performers: "全体演员" },
    ],
  },
  {
    id: "liaoning",
    name: "辽宁卫视春晚",
    fullName: "辽宁卫视春节联欢晚会",
    channel: "辽宁卫视",
    emoji: "😂",
    color: "#16a34a",
    programs: [
      { time: "19:30", name: "开场歌舞《东北马年好》", type: "歌舞", performers: "庞龙、刘和刚" },
      { time: "19:50", name: "小品《马年相亲记》", type: "小品", performers: "宋小宝、赵海燕" },
      { time: "20:15", name: "相声《东北往事》", type: "相声", performers: "岳云鹏、孙越" },
      { time: "20:35", name: "小品《老丈人驾到》", type: "小品", performers: "孙涛、邵峰" },
      { time: "21:00", name: "歌曲《东北的冬》", type: "歌舞", performers: "降央卓玛" },
      { time: "21:15", name: "小品《直播卖货》", type: "小品", performers: "文松、宋晓峰" },
      { time: "21:40", name: "相声《话说马年》", type: "相声", performers: "冯巩、闫学晶" },
      { time: "22:00", name: "小品《邻里之间》", type: "小品", performers: "杨树林、田娃" },
      { time: "22:25", name: "歌曲《咱们屯里的人》", type: "歌舞", performers: "赵本山弟子团" },
      { time: "22:50", name: "小品《幸福马上到》", type: "小品", performers: "贾冰、潘斌龙" },
    ],
  },
  {
    id: "guangdong",
    name: "广东卫视春晚",
    fullName: "广东卫视春节联欢晚会",
    channel: "广东卫视",
    emoji: "🌺",
    color: "#db2777",
    programs: [
      { time: "20:00", name: "开场歌舞《花开马年》", type: "歌舞", performers: "陈慧琳、李克勤" },
      { time: "20:20", name: "粤语相声《马照跑》", type: "相声", performers: "黄俊英、何宝文" },
      { time: "20:40", name: "歌曲《弯弯的月亮》", type: "歌舞", performers: "刘欢" },
      { time: "20:55", name: "小品《过年回家》", type: "小品", performers: "林永健、刘亮" },
      { time: "21:15", name: "粤剧《帝女花》选段", type: "戏曲", performers: "曾小敏、文汝清" },
      { time: "21:35", name: "歌曲《万水千山总是情》", type: "歌舞", performers: "汪明荃" },
      { time: "21:50", name: "杂技《醒狮闹春》", type: "杂技", performers: "广东杂技团" },
      { time: "22:10", name: "小品《大湾区故事》", type: "小品", performers: "张达、刘胜瑛" },
      { time: "22:30", name: "歌曲《海阔天空》", type: "歌舞", performers: "信乐团" },
      { time: "22:50", name: "歌舞《春暖花开》", type: "歌舞", performers: "全体演员" },
    ],
  },
];
