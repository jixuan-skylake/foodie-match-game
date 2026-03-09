/**
 * 吃货大作战 v3.0 - 动效系统 + 收集系统
 * 迭代2-3：丰富的动画效果 + 美食图鉴收集
 */

const systemInfo = wx.getSystemInfoSync();
const windowWidth = systemInfo.windowWidth;
const windowHeight = systemInfo.windowHeight;

const canvas = wx.createCanvas();
const ctx = canvas.getContext('2d');

// 游戏常量
const SLOT_COUNT = 7;
const MATCH_COUNT = 3;
const CARD_SIZE = Math.min(windowWidth / 5, 70);
const CARD_GAP = 10;

// 配色
const COLORS = {
  primary: '#FF6B35',
  secondary: '#FFD93D',
  accent: '#FF69B4',
  success: '#4CAF50',
  danger: '#FF4444',
  cardColors: ['#FF6B6B', '#FFB347', '#DDA0DD', '#FFD700', '#FF8C00', '#FF69B4', '#FFB6C1', '#CD853F', '#87CEEB']
};

// 美食类型
const FOOD_TYPES = [
  { id: 0, name: '火锅', emoji: '🍲', color: COLORS.cardColors[0], rarity: 'common', desc: '麻辣鲜香' },
  { id: 1, name: '烤肉', emoji: '🥩', color: COLORS.cardColors[1], rarity: 'common', desc: '滋滋冒油' },
  { id: 2, name: '奶茶', emoji: '🧋', color: COLORS.cardColors[2], rarity: 'rare', desc: '珍珠加料' },
  { id: 3, name: '炸鸡', emoji: '🍗', color: COLORS.cardColors[3], rarity: 'common', desc: '外酥里嫩' },
  { id: 4, name: '披萨', emoji: '🍕', color: COLORS.cardColors[4], rarity: 'rare', desc: '芝士拉丝' },
  { id: 5, name: '寿司', emoji: '🍣', color: COLORS.cardColors[5], rarity: 'epic', desc: '精致美味' },
  { id: 6, name: '蛋糕', emoji: '🍰', color: COLORS.cardColors[6], rarity: 'epic', desc: '甜蜜诱惑' },
  { id: 7, name: '汉堡', emoji: '🍔', color: COLORS.cardColors[7], rarity: 'common', desc: '经典美味' },
  { id: 8, name: '冰淇淋', emoji: '🍦', color: COLORS.cardColors[8], rarity: 'legendary', desc: '清凉解暑' },
];

// 稀有度颜色
const RARITY_COLORS = {
  common: '#AAAAAA',
  rare: '#4FC3F7',
  epic: '#BA68C8',
  legendary: '#FFD700'
};

// 关卡配置
const LEVELS = [
  { foodTypes: 4, cardsPerType: 3, layers: 2, name: '新手村', target: 600 },
  { foodTypes: 5, cardsPerType: 3, layers: 2, name: '美食街', target: 900 },
  { foodTypes: 6, cardsPerType: 3, layers: 3, name: '吃货天堂', target: 1200 },
  { foodTypes: 7, cardsPerType: 3, layers: 3, name: '饕餮盛宴', target: 1500 },
  { foodTypes: 8, cardsPerType: 3, layers: 3, name: '终极挑战', target: 1800 },
];

// 游戏状态
let gameState = {
  cards: [],
  slots: [],
  score: 0,
  level: 1,
  gameStatus: 'playing',
  combo: 0,
  maxCombo: 0,

  // 收集系统
  collection: {}, // 已收集的美食
  collectionCount: 0,

  // 动画系统
  animations: [],
  particles: [],
  floatingTexts: [],

  // 时间
  startTime: Date.now(),
  playTime: 0,

  // UI状态
  showCollection: false,
};

// ==================== 工具函数 ====================

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function adjustColor(color, amount) {
  const hex = color.replace('#', '');
  const r = Math.max(0, Math.min(255, parseInt(hex.substr(0, 2), 16) + amount));
  const g = Math.max(0, Math.min(255, parseInt(hex.substr(2, 2), 16) + amount));
  const b = Math.max(0, Math.min(255, parseInt(hex.substr(4, 2), 16) + amount));
  return '#' + r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + b.toString(16).padStart(2, '0');
}

function easeOutBack(x) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

function easeOutElastic(x) {
  const c4 = (2 * Math.PI) / 3;
  return x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
}

// ==================== 初始化 ====================

function initGame(level) {
  level = level || 1;
  const levelConfig = LEVELS[Math.min(level - 1, LEVELS.length - 1)];
  const prevScore = gameState.score;
  const prevCollection = gameState.collection;
  const prevCollectionCount = gameState.collectionCount;

  gameState = {
    cards: [],
    slots: [],
    score: level > 1 ? prevScore : 0,
    level: level,
    gameStatus: 'playing',
    combo: 0,
    maxCombo: level > 1 ? gameState.maxCombo : 0,
    collection: prevCollection || {},
    collectionCount: prevCollectionCount || 0,
    animations: [],
    particles: [],
    floatingTexts: [],
    startTime: Date.now(),
    playTime: 0,
    showCollection: false,
  };

  const usedFoodTypes = FOOD_TYPES.slice(0, levelConfig.foodTypes);
  const cardPool = [];

  usedFoodTypes.forEach(function(food, foodIndex) {
    for (let i = 0; i < levelConfig.cardsPerType; i++) {
      cardPool.push({
        type: foodIndex,
        food: food,
        x: 0,
        y: 0,
        layer: 0,
        collected: false,
        id: foodIndex + '-' + i,
        rotation: (Math.random() - 0.5) * 8,
        scale: 1,
        bounceOffset: 0,
      });
    }
  });

  shuffleArray(cardPool);

  const totalCards = cardPool.length;
  const layers = levelConfig.layers;
  const cardsPerLayer = Math.ceil(totalCards / layers);
  const cols = 5;
  const startX = (windowWidth - (cols * (CARD_SIZE + CARD_GAP) - CARD_GAP)) / 2;
  const startY = 130;

  cardPool.forEach(function(card, index) {
    const layer = Math.floor(index / cardsPerLayer);
    const posInLayer = index % cardsPerLayer;
    const row = Math.floor(posInLayer / cols);
    const col = posInLayer % cols;

    const offsetX = (Math.random() - 0.5) * 30;
    const offsetY = (Math.random() - 0.5) * 30;

    card.x = startX + col * (CARD_SIZE + CARD_GAP) + offsetX;
    card.y = startY + row * (CARD_SIZE + CARD_GAP) + layer * 40 + offsetY;
    card.layer = layer;
    card.originalY = card.y;
  });

  gameState.cards = cardPool.sort(function(a, b) { return a.layer - b.layer; });

  // 开场动画 - 卡片依次弹出
  gameState.cards.forEach(function(card, index) {
    gameState.animations.push({
      type: 'cardEnter',
      target: card,
      startTime: Date.now() + index * 30,
      duration: 400,
      startY: -100,
      endY: card.y,
    });
    card.y = -100;
  });
}

// ==================== 绘制函数 ====================

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawCard(card, isSlot) {
  isSlot = isSlot || false;
  const x = card.x;
  const y = card.y + (card.bounceOffset || 0);
  const food = card.food;
  const scale = card.scale || 1;
  const rotation = card.rotation || 0;

  ctx.save();

  const centerX = x + CARD_SIZE / 2;
  const centerY = y + CARD_SIZE / 2;

  ctx.translate(centerX, centerY);
  ctx.rotate(rotation * Math.PI / 180);
  ctx.scale(scale, scale);
  ctx.translate(-centerX, -centerY);

  // 阴影
  ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 5;

  // 卡片主体
  const gradient = ctx.createLinearGradient(x, y, x, y + CARD_SIZE);
  if (isSlot) {
    gradient.addColorStop(0, '#FFFFFF');
    gradient.addColorStop(1, '#F0F0F0');
  } else {
    gradient.addColorStop(0, food.color);
    gradient.addColorStop(1, adjustColor(food.color, -25));
  }
  ctx.fillStyle = gradient;
  roundRect(ctx, x, y, CARD_SIZE, CARD_SIZE, 12);
  ctx.fill();

  ctx.shadowColor = 'transparent';

  // 高光
  const highlightGradient = ctx.createLinearGradient(x, y, x, y + CARD_SIZE / 2);
  highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
  highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = highlightGradient;
  roundRect(ctx, x, y, CARD_SIZE, CARD_SIZE / 2, 12);
  ctx.fill();

  // 边框 + 稀有度指示
  ctx.strokeStyle = isSlot ? '#E0E0E0' : 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 3;
  roundRect(ctx, x, y, CARD_SIZE, CARD_SIZE, 12);
  ctx.stroke();

  // 稀有度角标
  if (!isSlot && food.rarity !== 'common') {
    ctx.fillStyle = RARITY_COLORS[food.rarity];
    ctx.beginPath();
    ctx.moveTo(x + CARD_SIZE - 20, y);
    ctx.lineTo(x + CARD_SIZE, y);
    ctx.lineTo(x + CARD_SIZE, y + 20);
    ctx.closePath();
    ctx.fill();
  }

  // Emoji
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowBlur = 3;
  ctx.shadowOffsetY = 2;
  ctx.font = 'bold ' + (CARD_SIZE * 0.45) + 'px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(food.emoji, centerX, y + CARD_SIZE * 0.4);
  ctx.shadowColor = 'transparent';

  // 名称标签
  const labelHeight = 16;
  const labelY = y + CARD_SIZE - labelHeight - 4;
  ctx.fillStyle = isSlot ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.95)';
  roundRect(ctx, x + 4, labelY, CARD_SIZE - 8, labelHeight, 8);
  ctx.fill();

  ctx.font = 'bold ' + (CARD_SIZE * 0.18) + 'px Arial';
  ctx.fillStyle = isSlot ? '#FFFFFF' : food.color;
  ctx.fillText(food.name, centerX, labelY + labelHeight / 2 + 1);

  ctx.restore();
}

function drawSlots() {
  const slotAreaY = windowHeight - CARD_SIZE - 90;
  const slotAreaWidth = SLOT_COUNT * (CARD_SIZE + CARD_GAP) - CARD_GAP;
  const startX = (windowWidth - slotAreaWidth) / 2;

  ctx.save();

  // 木质外框
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = 15;
  ctx.shadowOffsetY = 5;

  const woodGradient = ctx.createLinearGradient(startX - 20, slotAreaY - 25, startX - 20, slotAreaY + CARD_SIZE + 25);
  woodGradient.addColorStop(0, '#8B4513');
  woodGradient.addColorStop(0.5, '#A0522D');
  woodGradient.addColorStop(1, '#8B4513');
  ctx.fillStyle = woodGradient;
  roundRect(ctx, startX - 20, slotAreaY - 25, slotAreaWidth + 40, CARD_SIZE + 50, 15);
  ctx.fill();

  ctx.shadowColor = 'transparent';

  // 内部区域
  const innerGradient = ctx.createLinearGradient(startX - 10, slotAreaY - 15, startX - 10, slotAreaY + CARD_SIZE + 15);
  innerGradient.addColorStop(0, '#DEB887');
  innerGradient.addColorStop(0.5, '#F5DEB3');
  innerGradient.addColorStop(1, '#DEB887');
  ctx.fillStyle = innerGradient;
  roundRect(ctx, startX - 10, slotAreaY - 15, slotAreaWidth + 20, CARD_SIZE + 30, 10);
  ctx.fill();

  ctx.strokeStyle = '#654321';
  ctx.lineWidth = 3;
  roundRect(ctx, startX - 20, slotAreaY - 25, slotAreaWidth + 40, CARD_SIZE + 50, 15);
  ctx.stroke();

  ctx.restore();

  // 空槽位
  for (let i = 0; i < SLOT_COUNT; i++) {
    const slotX = startX + i * (CARD_SIZE + CARD_GAP);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    roundRect(ctx, slotX + 2, slotAreaY + 2, CARD_SIZE, CARD_SIZE, 10);
    ctx.fill();

    ctx.fillStyle = '#C4A574';
    roundRect(ctx, slotX, slotAreaY, CARD_SIZE, CARD_SIZE, 10);
    ctx.fill();

    ctx.strokeStyle = '#8B7355';
    ctx.lineWidth = 2;
    roundRect(ctx, slotX, slotAreaY, CARD_SIZE, CARD_SIZE, 10);
    ctx.stroke();
  }

  // 槽位中的卡片
  gameState.slots.forEach(function(card, index) {
    const slotX = startX + index * (CARD_SIZE + CARD_GAP);
    const slotCard = {
      food: card.food,
      type: card.type,
      x: slotX,
      y: slotAreaY,
      rotation: 0,
      scale: 1,
      bounceOffset: 0,
    };
    drawCard(slotCard, true);
  });
}

function drawUI() {
  const levelConfig = LEVELS[Math.min(gameState.level - 1, LEVELS.length - 1];

  // 顶部背景
  const headerGradient = ctx.createLinearGradient(0, 0, 0, 90);
  headerGradient.addColorStop(0, 'rgba(255, 107, 53, 0.98)');
  headerGradient.addColorStop(1, 'rgba(255, 200, 100, 0.95)');
  ctx.fillStyle = headerGradient;
  roundRect(ctx, 0, 0, windowWidth, 90, 0);
  ctx.fill();

  // 波浪装饰
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.beginPath();
  ctx.moveTo(0, 85);
  for (let i = 0; i <= windowWidth; i += 15) {
    ctx.lineTo(i, 85 + Math.sin(i * 0.04 + Date.now() * 0.002) * 4);
  }
  ctx.lineTo(windowWidth, 90);
  ctx.lineTo(0, 90);
  ctx.closePath();
  ctx.fill();

  // 标题
  ctx.font = 'bold 24px Arial';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 2;
  ctx.fillText('🍔 吃货大作战 🍕', windowWidth / 2, 30);
  ctx.shadowColor = 'transparent';

  // 关卡信息
  ctx.font = 'bold 14px Arial';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('第' + gameState.level + '关 · ' + levelConfig.name + ' · 目标:' + levelConfig.target + '分', windowWidth / 2, 52);

  // 分数
  ctx.textAlign = 'left';
  ctx.font = 'bold 18px Arial';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('💰 ' + gameState.score, 15, 75);

  // 连击
  if (gameState.combo > 0) {
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 14px Arial';
    ctx.fillText('🔥 x' + gameState.combo, 100, 75);
  }

  // 收集进度
  ctx.textAlign = 'right';
  ctx.font = 'bold 14px Arial';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('📖 ' + gameState.collectionCount + '/9', windowWidth - 15, 52);

  // 剩余/槽位
  const remaining = gameState.cards.filter(function(c) { return !c.collected; }).length;
  ctx.font = 'bold 16px Arial';
  ctx.fillText('剩余:' + remaining, windowWidth - 15, 75);

  // 槽位警告
  if (gameState.slots.length >= 6) {
    ctx.fillStyle = '#FF6B6B';
    ctx.font = 'bold 12px Arial';
    ctx.fillText('⚠️ 槽位将满!', windowWidth - 80, 52);
  }
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, windowHeight);
  gradient.addColorStop(0, '#FFE5B4');
  gradient.addColorStop(0.5, '#FFDAB9');
  gradient.addColorStop(1, '#FFE4C4');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, windowWidth, windowHeight);

  // 装饰
  ctx.globalAlpha = 0.06;
  ctx.font = '50px Arial';
  ctx.textAlign = 'center';
  const decor = ['🍕', '🍔', '🍟', '🍩', '🍪', '🧁', '🍰', '🍫'];
  for (let i = 0; i < 8; i++) {
    ctx.fillText(decor[i], (i * 47 + 30) % windowWidth, (i * 83 + 150) % (windowHeight - 250) + 150);
  }
  ctx.globalAlpha = 1;
}

function drawParticles() {
  gameState.particles = gameState.particles.filter(function(p) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.3;
    p.life -= 0.025;
    p.rotation += p.rotationSpeed || 0;

    if (p.life <= 0) return false;

    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation || 0);
    ctx.fillStyle = p.color;
    ctx.font = p.size + 'px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.emoji || '●', 0, 0);
    ctx.restore();

    return true;
  });
}

function drawFloatingTexts() {
  gameState.floatingTexts = gameState.floatingTexts.filter(function(t) {
    t.y -= 2.5;
    t.life -= 0.02;

    if (t.life <= 0) return false;

    ctx.globalAlpha = t.life;
    ctx.font = 'bold ' + t.size + 'px Arial';
    ctx.fillStyle = t.color;
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 4;
    ctx.fillText(t.text, t.x, t.y);
    ctx.shadowColor = 'transparent';
    ctx.globalAlpha = 1;

    return true;
  });
}

function drawGameOver() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.88)';
  ctx.fillRect(0, 0, windowWidth, windowHeight);

  const boxWidth = windowWidth * 0.88;
  const boxHeight = 320;
  const boxX = (windowWidth - boxWidth) / 2;
  const boxY = (windowHeight - boxHeight) / 2;

  // 框体
  const boxGradient = ctx.createLinearGradient(boxX, boxY, boxX, boxY + boxHeight);
  boxGradient.addColorStop(0, '#FFFFFF');
  boxGradient.addColorStop(1, '#F8F8F8');
  ctx.fillStyle = boxGradient;
  roundRect(ctx, boxX, boxY, boxWidth, boxHeight, 25);
  ctx.fill();

  ctx.strokeStyle = gameState.gameStatus === 'win' ? '#4CAF50' : '#FF6B6B';
  ctx.lineWidth = 4;
  roundRect(ctx, boxX, boxY, boxWidth, boxHeight, 25);
  ctx.stroke();

  // 图标
  ctx.font = '70px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(gameState.gameStatus === 'win' ? '🎉' : '😢', windowWidth / 2, boxY + 75);

  // 标题
  ctx.font = 'bold 30px Arial';
  ctx.fillStyle = gameState.gameStatus === 'win' ? '#4CAF50' : '#FF6B6B';
  ctx.fillText(gameState.gameStatus === 'win' ? '恭喜过关！' : '再接再厉！', windowWidth / 2, boxY + 125);

  // 统计
  ctx.font = '16px Arial';
  ctx.fillStyle = '#888888';
  ctx.fillText('得分', windowWidth / 2, boxY + 160);

  ctx.font = 'bold 42px Arial';
  ctx.fillStyle = '#FF6B35';
  ctx.fillText(gameState.score.toString(), windowWidth / 2, boxY + 200);

  // 统计信息
  ctx.font = '14px Arial';
  ctx.fillStyle = '#666666';
  ctx.fillText('最高连击: ' + gameState.maxCombo + ' | 收集美食: ' + gameState.collectionCount, windowWidth / 2, boxY + 235);

  // 按钮
  const btnY = boxY + boxHeight - 55;
  const btnGradient = ctx.createLinearGradient(boxX + 25, btnY - 22, boxX + boxWidth - 25, btnY + 22);
  btnGradient.addColorStop(0, '#FF6B35');
  btnGradient.addColorStop(1, '#FFB347');
  ctx.fillStyle = btnGradient;
  roundRect(ctx, boxX + 25, btnY - 22, boxWidth - 50, 44, 22);
  ctx.fill();

  ctx.font = 'bold 18px Arial';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(gameState.gameStatus === 'win' ? '👆 继续下一关' : '👆 重新开始', windowWidth / 2, btnY + 5);
}

// ==================== 动画系统 ====================

function updateAnimations() {
  const now = Date.now();

  gameState.animations = gameState.animations.filter(function(anim) {
    if (now < anim.startTime) return true;

    const elapsed = now - anim.startTime;
    const progress = Math.min(1, elapsed / anim.duration);

    if (anim.type === 'cardEnter') {
      const eased = easeOutBack(progress);
      anim.target.y = anim.startY + (anim.endY - anim.startY) * eased;
    } else if (anim.type === 'cardBounce') {
      const eased = easeOutElastic(progress);
      anim.target.bounceOffset = Math.sin(progress * Math.PI * 3) * 10 * (1 - progress);
    } else if (anim.type === 'scaleUp') {
      const eased = easeOutBack(progress);
      anim.target.scale = 1 + 0.15 * Math.sin(progress * Math.PI);
    }

    return progress < 1;
  });
}

function createParticles(x, y, food, count) {
  count = count || 12;
  for (let i = 0; i < count; i++) {
    gameState.particles.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 12,
      vy: (Math.random() - 0.5) * 12 - 6,
      size: Math.random() * 20 + 15,
      color: food.color,
      emoji: food.emoji,
      life: 1,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.3,
    });
  }
}

function createFloatingText(x, y, text, color, size) {
  gameState.floatingTexts.push({
    x: x, y: y, text: text,
    color: color || '#FFD700',
    size: size || 26,
    life: 1,
  });
}

// ==================== 游戏逻辑 ====================

function checkMatch() {
  const typeCounts = {};

  gameState.slots.forEach(function(card, index) {
    if (!typeCounts[card.type]) typeCounts[card.type] = [];
    typeCounts[card.type].push(index);
  });

  let hasMatch = false;

  Object.keys(typeCounts).forEach(function(type) {
    if (typeCounts[type].length >= MATCH_COUNT) {
      hasMatch = true;
      const indices = typeCounts[type].slice(0, MATCH_COUNT).sort(function(a, b) { return b - a; });

      const slotAreaY = windowHeight - CARD_SIZE - 90;
      const slotAreaWidth = SLOT_COUNT * (CARD_SIZE + CARD_GAP) - CARD_GAP;
      const startX = (windowWidth - slotAreaWidth) / 2;

      const eliminatedFood = gameState.slots[indices[0]].food;

      indices.forEach(function(index) {
        const card = gameState.slots[index];
        const slotX = startX + index * (CARD_SIZE + CARD_GAP);
        createParticles(slotX + CARD_SIZE / 2, slotAreaY + CARD_SIZE / 2, card.food, 15);
      });

      indices.forEach(function(index) {
        gameState.slots.splice(index, 1);
      });

      // 收集美食
      if (!gameState.collection[eliminatedFood.id]) {
        gameState.collection[eliminatedFood.id] = true;
        gameState.collectionCount++;
        createFloatingText(windowWidth / 2, windowHeight / 2 - 50, '📖 新美食解锁: ' + eliminatedFood.name + '!', RARITY_COLORS[eliminatedFood.rarity], 20);
      }
    }
  });

  return hasMatch;
}

function checkGameState() {
  const remaining = gameState.cards.filter(function(c) { return !c.collected; }).length;

  if (remaining === 0 && gameState.slots.length === 0) {
    gameState.gameStatus = 'win';
    gameState.score += 500;
    return;
  }

  if (gameState.slots.length >= SLOT_COUNT) {
    const typeCounts = {};
    gameState.slots.forEach(function(card) {
      typeCounts[card.type] = (typeCounts[card.type] || 0) + 1;
    });

    let canMatch = false;
    Object.keys(typeCounts).forEach(function(type) {
      if (typeCounts[type] >= MATCH_COUNT) canMatch = true;
    });

    if (!canMatch) {
      gameState.gameStatus = 'lose';
    }
  }
}

function collectCard(card) {
  card.collected = true;
  gameState.slots.push(card);
  gameState.slots.sort(function(a, b) { return a.type - b.type; });

  const matched = checkMatch();

  if (matched) {
    gameState.combo++;
    if (gameState.combo > gameState.maxCombo) gameState.maxCombo = gameState.combo;
    const bonus = 100 * gameState.combo;
    gameState.score += bonus;

    createFloatingText(
      windowWidth / 2,
      windowHeight - CARD_SIZE - 130,
      '+' + bonus + (gameState.combo > 1 ? ' 🔥x' + gameState.combo : ''),
      '#FFD700',
      30
    );
  } else {
    gameState.combo = 0;
  }

  checkGameState();
}

function handleClick(event) {
  if (gameState.gameStatus !== 'playing') {
    if (gameState.gameStatus === 'win') {
      initGame(gameState.level + 1);
    } else {
      initGame(1);
    }
    return;
  }

  const clientX = event.clientX;
  const clientY = event.clientY;

  for (let i = gameState.cards.length - 1; i >= 0; i--) {
    const card = gameState.cards[i];
    if (card.collected) continue;

    if (clientX >= card.x && clientX <= card.x + CARD_SIZE &&
        clientY >= card.y && clientY <= card.y + CARD_SIZE) {

      let isBlocked = false;
      for (let j = 0; j < gameState.cards.length; j++) {
        const other = gameState.cards[j];
        if (i === j || other.collected || other.layer <= card.layer) continue;

        if (other.x < card.x + CARD_SIZE && other.x + CARD_SIZE > card.x &&
            other.y < card.y + CARD_SIZE && other.y + CARD_SIZE > card.y) {
          isBlocked = true;
          break;
        }
      }

      if (!isBlocked) {
        collectCard(card);
      }
      break;
    }
  }
}

// ==================== 主循环 ====================

function render() {
  updateAnimations();

  drawBackground();
  drawUI();

  gameState.cards.forEach(function(card) {
    if (!card.collected) drawCard(card, false);
  });

  drawSlots();
  drawParticles();
  drawFloatingTexts();

  if (gameState.gameStatus !== 'playing') {
    drawGameOver();
  }

  requestAnimationFrame(render);
}

// ==================== 启动 ====================

wx.onTouchStart(function(event) {
  handleClick({ clientX: event.touches[0].clientX, clientY: event.touches[0].clientY });
});

initGame(1);
render();

console.log('🍔 吃货大作战 v3.0 - 动效+收集系统 已启动！');
