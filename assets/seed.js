/* 示例菜单：36 道家常菜。首次打开时写入；之后可以随便删改。 */
const DISH_CATS = ['招牌', '热菜', '素菜', '汤羹', '主食', '凉菜', '饮品'];

const SEED_DISHES = [
  /* ---------- 招牌 ---------- */
  { id: 'd01', name: '可乐鸡翅', cat: '招牌', emoji: '🍗', desc: '甜咸挂汁，收汁收得发亮', price: 28, minutes: 30, tags: ['下饭', '甜口'],
    ingredients: ['鸡翅中 10个', '可乐 1罐', '姜 3片', '生抽 2勺', '老抽 半勺'] },
  { id: 'd02', name: '红烧肉', cat: '招牌', emoji: '🥘', desc: '冰糖上色，肥而不腻', price: 38, minutes: 80, tags: ['硬菜', '下饭'],
    ingredients: ['五花肉 500g', '冰糖 20g', '八角 2颗', '生抽 3勺', '老抽 1勺', '姜 4片'] },
  { id: 'd03', name: '番茄炒蛋', cat: '招牌', emoji: '🍅', desc: '家常第一名，汤汁拌饭', price: 12, minutes: 10, tags: ['快手', '下饭'],
    ingredients: ['番茄 2个', '鸡蛋 3个', '糖 1小勺', '葱花 少许'] },
  { id: 'd04', name: '糖醋排骨', cat: '招牌', emoji: '🍖', desc: '酸甜挂浆，小孩最爱', price: 36, minutes: 45, tags: ['硬菜', '酸甜'],
    ingredients: ['肋排 500g', '香醋 3勺', '糖 2勺', '番茄酱 1勺', '白芝麻 少许'] },
  { id: 'd05', name: '宫保鸡丁', cat: '招牌', emoji: '🌶️', desc: '花生脆，鸡丁嫩，糊辣荔枝味', price: 26, minutes: 25, tags: ['辣', '下饭'],
    ingredients: ['鸡腿肉 300g', '花生米 一把', '干辣椒 6个', '花椒 1小勺', '葱 2根'] },

  /* ---------- 热菜 ---------- */
  { id: 'd06', name: '青椒肉丝', cat: '热菜', emoji: '🥩', desc: '大火快炒，青椒还带脆', price: 22, minutes: 15, tags: ['快手', '下饭'],
    ingredients: ['里脊 250g', '青椒 3个', '蒜 2瓣', '生抽 1勺'] },
  { id: 'd07', name: '鱼香肉丝', cat: '热菜', emoji: '🍆', desc: '酸甜微辣，其实没有鱼', price: 24, minutes: 25, tags: ['辣', '下饭'],
    ingredients: ['里脊 250g', '木耳 一小把', '胡萝卜 半根', '泡椒 2个', '蒜 3瓣'] },
  { id: 'd08', name: '麻婆豆腐', cat: '热菜', emoji: '🌶️', desc: '麻辣烫口，拌饭一绝', price: 18, minutes: 20, tags: ['辣', '下饭'],
    ingredients: ['嫩豆腐 1盒', '牛肉末 100g', '豆瓣酱 2勺', '花椒粉 少许', '葱花'] },
  { id: 'd09', name: '干煸四季豆', cat: '热菜', emoji: '🫛', desc: '外皮起皱才够香', price: 18, minutes: 20, tags: ['辣', '下饭'],
    ingredients: ['四季豆 400g', '肉末 80g', '干辣椒 5个', '蒜 3瓣'] },
  { id: 'd10', name: '香菇滑鸡', cat: '热菜', emoji: '🍄', desc: '蒸出来的嫩，不油腻', price: 28, minutes: 30, tags: ['清淡', '少油'],
    ingredients: ['鸡腿肉 300g', '干香菇 6朵', '姜丝 少许', '蚝油 1勺'] },
  { id: 'd11', name: '土豆炖牛肉', cat: '热菜', emoji: '🥔', desc: '炖到筷子一夹就断', price: 42, minutes: 90, tags: ['硬菜', '炖菜'],
    ingredients: ['牛腩 500g', '土豆 2个', '胡萝卜 1根', '洋葱 半个', '番茄 1个'] },
  { id: 'd12', name: '辣子鸡', cat: '热菜', emoji: '🌶️', desc: '干香酥脆，越嚼越香', price: 32, minutes: 40, tags: ['辣', '硬菜'],
    ingredients: ['鸡腿肉 400g', '干辣椒 一把', '花椒 1勺', '白芝麻 少许'] },
  { id: 'd13', name: '回锅肉', cat: '热菜', emoji: '🥓', desc: '灯盏窝，豆瓣香', price: 26, minutes: 30, tags: ['辣', '下饭'],
    ingredients: ['五花肉 300g', '蒜苗 3根', '豆瓣酱 2勺', '豆豉 1勺'] },
  { id: 'd14', name: '蒜蓉粉丝虾', cat: '热菜', emoji: '🍤', desc: '蒸八分钟，鲜得很', price: 45, minutes: 15, tags: ['清淡', '快手'],
    ingredients: ['基围虾 12只', '粉丝 1把', '蒜 1头', '蒸鱼豉油 2勺'] },

  /* ---------- 素菜 ---------- */
  { id: 'd15', name: '清炒时蔬', cat: '素菜', emoji: '🥬', desc: '当季青菜，蒜香打底', price: 10, minutes: 8, tags: ['清淡', '快手'],
    ingredients: ['时令青菜 400g', '蒜 3瓣', '盐 少许'] },
  { id: 'd16', name: '蒜蓉西兰花', cat: '素菜', emoji: '🥦', desc: '先焯后炒，颜色翠绿', price: 14, minutes: 12, tags: ['清淡', '快手'],
    ingredients: ['西兰花 1颗', '蒜 4瓣', '蚝油 1勺'] },
  { id: 'd17', name: '手撕包菜', cat: '素菜', emoji: '🥬', desc: '手撕的比刀切的好吃', price: 12, minutes: 10, tags: ['辣', '快手'],
    ingredients: ['包菜 半颗', '干辣椒 4个', '蒜 2瓣', '香醋 1勺'] },
  { id: 'd18', name: '地三鲜', cat: '素菜', emoji: '🍆', desc: '土豆茄子青椒，过油才香', price: 18, minutes: 25, tags: ['下饭'],
    ingredients: ['土豆 1个', '茄子 1根', '青椒 2个', '蒜 3瓣', '生抽 2勺'] },
  { id: 'd19', name: '醋溜白菜', cat: '素菜', emoji: '🥬', desc: '酸香开胃，配米饭很好', price: 10, minutes: 12, tags: ['快手', '开胃'],
    ingredients: ['白菜 半颗', '干辣椒 3个', '香醋 3勺', '糖 1小勺'] },
  { id: 'd20', name: '韭菜炒蛋', cat: '素菜', emoji: '🥚', desc: '十分钟的家常味', price: 12, minutes: 10, tags: ['快手'],
    ingredients: ['韭菜 一把', '鸡蛋 3个', '盐 少许'] },

  /* ---------- 汤羹 ---------- */
  { id: 'd21', name: '番茄蛋汤', cat: '汤羹', emoji: '🍅', desc: '三分钟一锅，酸甜开胃', price: 8, minutes: 8, tags: ['快手', '清淡'],
    ingredients: ['番茄 1个', '鸡蛋 2个', '葱花 少许', '香油 几滴'] },
  { id: 'd22', name: '紫菜蛋花汤', cat: '汤羹', emoji: '🌊', desc: '蛋花要细，虾皮提鲜', price: 6, minutes: 6, tags: ['快手', '清淡'],
    ingredients: ['紫菜 一小把', '鸡蛋 2个', '虾皮 1小勺', '香油 几滴'] },
  { id: 'd23', name: '冬瓜排骨汤', cat: '汤羹', emoji: '🍲', desc: '清甜不腻，夏天合适', price: 26, minutes: 60, tags: ['清淡', '炖菜'],
    ingredients: ['排骨 400g', '冬瓜 300g', '姜 3片', '枸杞 一小把'] },
  { id: 'd24', name: '玉米排骨汤', cat: '汤羹', emoji: '🌽', desc: '玉米自带甜味，不用放糖', price: 28, minutes: 60, tags: ['清淡', '炖菜'],
    ingredients: ['排骨 400g', '玉米 2根', '胡萝卜 1根', '姜 3片'] },
  { id: 'd25', name: '酸辣汤', cat: '汤羹', emoji: '🌶️', desc: '胡椒下重手，喝完出汗', price: 12, minutes: 15, tags: ['辣', '开胃'],
    ingredients: ['豆腐 半盒', '木耳 少许', '鸡蛋 1个', '白胡椒粉 1小勺', '香醋 2勺'] },

  /* ---------- 主食 ---------- */
  { id: 'd26', name: '蛋炒饭', cat: '主食', emoji: '🍚', desc: '隔夜饭炒，粒粒分明', price: 12, minutes: 10, tags: ['快手', '主食'],
    ingredients: ['隔夜饭 2碗', '鸡蛋 2个', '葱花 少许', '生抽 1勺'] },
  { id: 'd27', name: '阳春面', cat: '主食', emoji: '🍜', desc: '猪油加葱花，简单的好吃', price: 10, minutes: 10, tags: ['快手', '主食'],
    ingredients: ['细面 200g', '猪油 1勺', '生抽 2勺', '葱花 一把'] },
  { id: 'd28', name: '猪肉白菜饺子', cat: '主食', emoji: '🥟', desc: '现包现煮，一锅正好', price: 24, minutes: 50, tags: ['主食', '硬菜'],
    ingredients: ['饺子皮 40张', '猪肉馅 400g', '白菜 半颗', '姜末 少许', '香油 2勺'] },
  { id: 'd29', name: '手抓饼', cat: '主食', emoji: '🫓', desc: '加蛋加肠，五分钟搞定', price: 8, minutes: 6, tags: ['快手', '主食'],
    ingredients: ['手抓饼 2张', '鸡蛋 2个', '生菜 2片', '火腿肠 2根'] },
  { id: 'd30', name: '葱油拌面', cat: '主食', emoji: '🍜', desc: '小葱熬到焦香，拌开就行', price: 12, minutes: 15, tags: ['主食'],
    ingredients: ['面条 200g', '小葱 一把', '生抽 3勺', '糖 1勺'] },

  /* ---------- 凉菜 ---------- */
  { id: 'd31', name: '凉拌黄瓜', cat: '凉菜', emoji: '🥒', desc: '拍碎更入味，冰过更好', price: 8, minutes: 8, tags: ['快手', '开胃', '清淡'],
    ingredients: ['黄瓜 2根', '蒜 3瓣', '香醋 2勺', '香油 1勺'] },
  { id: 'd32', name: '皮蛋豆腐', cat: '凉菜', emoji: '🥚', desc: '一拌就好，不用开火', price: 10, minutes: 5, tags: ['快手', '清淡'],
    ingredients: ['内酯豆腐 1盒', '皮蛋 2个', '小葱 一把', '生抽 2勺'] },
  { id: 'd33', name: '凉拌木耳', cat: '凉菜', emoji: '🍄', desc: '脆，酸辣，配粥配面都行', price: 10, minutes: 15, tags: ['开胃', '辣'],
    ingredients: ['干木耳 一把', '小米椒 2个', '香菜 一把', '香醋 2勺'] },

  /* ---------- 饮品 ---------- */
  { id: 'd34', name: '柠檬水', cat: '饮品', emoji: '🍋', desc: '冰镇一下，解腻', price: 6, minutes: 3, tags: ['快手', '清爽'],
    ingredients: ['柠檬 1个', '蜂蜜 1勺', '冰水 1壶'] },
  { id: 'd35', name: '酸梅汤', cat: '饮品', emoji: '🥤', desc: '熬一壶放冰箱，能喝两天', price: 8, minutes: 40, tags: ['清爽'],
    ingredients: ['乌梅 10颗', '山楂 一小把', '冰糖 30g', '桂花 少许'] },
  { id: 'd36', name: '冰可乐', cat: '饮品', emoji: '🥤', desc: '加片柠檬更像那么回事', price: 5, minutes: 1, tags: ['清爽'],
    ingredients: ['可乐 1罐', '柠檬 1片', '冰块 一杯'] }
];
