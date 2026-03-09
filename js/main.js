/**
 * 吃货大作战 v3.0 - 动效增强版
 * 迭代2：点击反馈、卡片飞入、消除爆炸、胜利庆祝
 */

const systemInfo = wx.getSystemInfoSync();
const windowWidth = systemInfo.windowWidth;
const windowHeight = systemInfo.windowHeight;
const pixelRatio = systemInfo.pixelRatio;

const canvas = wx.createCanvas();
const ctx = canvas.getContext('2d');

// 游戏常量
const SLOT_COUNT = 7;
const MATCH_COUNT = 3;
const CARD_SIZE = Math.min(windowWidth / 5, 70);
const CARD_GAP = 10;

// 🎨 配色方案
const THEMES = {
  primary: '#FF6B35',
  secondary: '#FFD93D',
  accent: '#FF69B4',
  success: '#4CAF50',
  danger: '#FF4444',
  bgGradientTop: '#FFE5B4',
  bgGradientBottom: '#FFDAB9',
  cardColors: [
    '#FF6B6B', '#FFB347', '#DDA0DD', '#FFD700',
    '#FF8C00', '#FF69B4', '#FFB6C1', '#CD853F', '#87CEEB'
  ]
};

// 美食类型
const FOOD_TYPES = [
  { name: '火锅', color: THEMES.cardColors[0], emoji: '🍲', desc: '麻辣鲜香' },
  { name: '烤肉', color: THEMES.cardColors[1], emoji: '🥩', desc: '滋滋冒油' },
  { name: '奶茶', color: THEMES.cardColors[2], emoji: '🧋', desc: '珍珠加料' },
  { name: '炸鸡', color: THEMES.cardColors[3], emoji: '🍗', desc: '外酥里嫩' },
  { name: '披萨', color: THEMES.cardColors[4], emoji: '🍕', desc: '芝士拉丝' },
  { name: '寿司', color: THEMES.cardColors[5], emoji: '🍣', desc: '精致美味' },
  { name: '蛋糕', color: THEMES.cardColors[6], emoji: '🍰', desc: '甜蜜诱惑' },
  { name: '汉堡', color: THEMES.cardColors[7], emoji: '🍔', desc: '经典美味' },
  { name: '冰淇淋', color: THEMES.cardColors[8], emoji: '🍦', desc: '清凉解暑' }
];

// 关卡配置
const LEVELS = [
  { foodTypes: 4, cardsPerType: 3, layers: 2, name: '新手村', bgTheme: 'warm' },
  { foodTypes: 5, cardsPerType: 3, layers: 2, name: '美食街', bgTheme: 'fresh' },
  { foodTypes: 6, cardsPerType: 3, layers: 3, name: '吃货天堂', bgTheme: 'sweet' },
  { foodTypes: 7, cardsPerType: 3, layers: 3, name: '饕餮盛宴', bgTheme: 'spicy' },
  { foodTypes: 8, cardsPerType: 3, layers: 3, name: '终极挑战', bgTheme: 'rainbow' }
];

// 游戏状态
let gameState = {
  cards: [],
  slots: [],
  score: 0,
  level: 1,
  gameStatus: 'playing',
  combo: 0,
  totalEliminated: 0,
  particles: [],
  floatingTexts: [],
  clickEffects: [],     // 点击涟漪效果
  flyCards: [],        // 飞入槽位的卡片
  celebrateParticles: [], // 胜利庆祝粒子
  lastClickTime: 0
};

// 动画变量
let animationFrame = 0;

// 洗牌算法
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// 缓动函数 - 让动画更流畅
function easeOutElastic(t) {
  const c4 = (2 * Math.PI) / 3;
  return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function easeOutQuart(t) {
  return 1 - Math.pow(1 - t, 4);
}

// 初始化游戏
function initGame(level) {
  level = level || 1;
  const levelConfig = LEVELS[Math.min(level - 1, LEVELS.length - 1)];
  const prevScore = gameState.score;

  gameState = {
    cards: [],
    slots: [],
    score: level > 1 ? prevScore : 0,
    level: level,
    gameStatus: 'playing',
    combo: 0,
    totalEliminated: gameState.totalEliminated || 0,
    particles: [],
    floatingTexts: [],
    clickEffects: [],
    flyCards: [],
    celebrateParticles: [],
    lastClickTime: 0
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
        scale: 1,
        rotation: 0,
        isAnimating: false,
        opacity: 1
      });
    }
  });

  shuffleArray(cardPool);

  const totalCards = cardPool.length;
  const layers = levelConfig.layers;
  const cardsPerLayer = Math.ceil(totalCards / layers);
  const cols = 5;

  const startX = (windowWidth - (cols * (CARD_SIZE + CARD_GAP) - CARD_GAP)) / 2;
  const startY = 120;

  cardPool.forEach(function(card, index) {
    const layer = Math.floor(index / cardsPerLayer);
    const posInLayer = index % cardsPerLayer;
    const row = Math.floor(posInLayer / cols);
    const col = posInLayer % cols;

    const offsetX = (Math.random() - 0.5) * 30;
    const offsetY = (Math.random() - 0.5) * 30;
    const rotation = (Math.random() - 0.5) * 10;

    card.x = startX + col * (CARD_SIZE + CARD_GAP) + offsetX;
    card.y = startY + row * (CARD_SIZE + CARD_GAP) + layer * 40 + offsetY;
    card.layer = layer;
    card.rotation = rotation;
  });

  gameState.cards = cardPool.sort(function(a, b) { return a.layer - b.layer; });
}

// 绘制圆角矩形
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

// 绘制精美卡片
function drawCard(card, isSlot) {
  isSlot = isSlot || false;
  const x = card.x;
  const y = card.y;
  const food = card.food;
  const rotation = card.rotation || 0;
  const scale = card.scale || 1;
  const opacity = card.opacity !== undefined ? card.opacity : 1;

  ctx.save();

  // 应用透明度
  ctx.globalAlpha = opacity;

  // 应用缩放
  const centerX = x + CARD_SIZE / 2;
  const centerY = y + CARD_SIZE / 2;
  ctx.translate(centerX, centerY);
  ctx.scale(scale, scale);

  // 应用旋转
  if (rotation !== 0 && !isSlot) {
    ctx.rotate(rotation * Math.PI / 180);
  }
  ctx.translate(-centerX, -centerY);

  // 多层阴影
  ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
  ctx.shadowBlur = 15;
  ctx.shadowOffsetX = 4;
  ctx.shadowOffsetY = 6;

  // 卡片主体渐变
  const gradient = ctx.createLinearGradient(x, y, x, y + CARD_SIZE);
  if (isSlot) {
    gradient.addColorStop(0, '#FFFFFF');
    gradient.addColorStop(1, '#F0F0F0');
  } else {
    gradient.addColorStop(0, food.color);
    gradient.addColorStop(1, adjustColor(food.color, -20));
  }
  ctx.fillStyle = gradient;
  roundRect(ctx, x, y, CARD_SIZE, CARD_SIZE, 12);
  ctx.fill();

  // 清除阴影
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // 高光
  const highlightGradient = ctx.createLinearGradient(x, y, x, y + CARD_SIZE / 2);
  highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
  highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = highlightGradient;
  roundRect(ctx, x, y, CARD_SIZE, CARD_SIZE / 2, 12);
  ctx.fill();

  // 边框
  ctx.strokeStyle = isSlot ? '#E0E0E0' : 'rgba(255, 255, 255, 0.8)';
  ctx.lineWidth = 3;
  roundRect(ctx, x, y, CARD_SIZE, CARD_SIZE, 12);
  ctx.stroke();

  // 内边框
  ctx.strokeStyle = isSlot ? '#F5F5F5' : 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 1;
  roundRect(ctx, x + 2, y + 2, CARD_SIZE - 4, CARD_SIZE - 4, 10);
  ctx.stroke();

  // Emoji 阴影
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 2;
  ctx.font = 'bold ' + (CARD_SIZE * 0.45) + 'px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(food.emoji, x + CARD_SIZE / 2, y + CARD_SIZE * 0.42);

  ctx.shadowColor = 'transparent';

  // 名称标签
  const labelWidth = CARD_SIZE - 10;
  const labelHeight = 16;
  const labelX = x + 5;
  const labelY = y + CARD_SIZE - labelHeight - 4;

  ctx.fillStyle = isSlot ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.9)';
  roundRect(ctx, labelX, labelY, labelWidth, labelHeight, 8);
  ctx.fill();

  ctx.font = 'bold ' + (CARD_SIZE * 0.18) + 'px Arial';
  ctx.fillStyle = isSlot ? '#FFFFFF' : food.color;
  ctx.fillText(food.name, x + CARD_SIZE / 2, labelY + labelHeight / 2 + 1);

  ctx.restore();
}

// 颜色调整
function adjustColor(color, amount) {
  const hex = color.replace('#', '');
  const r = Math.max(0, Math.min(255, parseInt(hex.substr(0, 2), 16) + amount));
  const g = Math.max(0, Math.min(255, parseInt(hex.substr(2, 2), 16) + amount));
  const b = Math.max(0, Math.min(255, parseInt(hex.substr(4, 2), 16) + amount));
  return '#' + r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + b.toString(16).padStart(2, '0');
}

// 绘制点击涟漪效果
function drawClickEffects() {
  gameState.clickEffects = gameState.clickEffects.filter(function(effect) {
    effect.radius += 3;
    effect.alpha -= 0.05;

    if (effect.alpha <= 0) return false;

    ctx.save();
    ctx.globalAlpha = effect.alpha;
    ctx.strokeStyle = effect.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    return true;
  });
}

// 绘制飞入槽位的卡片
function drawFlyCards() {
  gameState.flyCards = gameState.flyCards.filter(function(flyCard) {
    flyCard.progress += 0.08;
    flyCard.currentX = flyCard.startX + (flyCard.endX - flyCard.startX) * easeOutQuart(flyCard.progress);
    flyCard.currentY = flyCard.startY + (flyCard.endY - flyCard.startY) * easeOutQuart(flyCard.progress);
    flyCard.rotation = flyCard.startRotation * (1 - flyCard.progress);

    if (flyCard.progress >= 1) {
      // 飞入完成，添加到槽位
      const slotCard = {
        food: flyCard.card.food,
        type: flyCard.card.type,
        x: flyCard.endX,
        y: flyCard.endY,
        rotation: 0,
        scale: 1,
        opacity: 1
      };
      gameState.slots.push(slotCard);
      gameState.slots.sort(function(a, b) { return a.type - b.type; });
      return false;
    }

    // 绘制飞中的卡片
    const tempCard = {
      food: flyCard.card.food,
      type: flyCard.card.type,
      x: flyCard.currentX,
      y: flyCard.currentY,
      rotation: flyCard.rotation,
      scale: flyCard.progress * 0.3 + 0.7, // 先小后大
      opacity: 1
    };
    drawCard(tempCard, false);

    return true;
  });
}

// 绘制槽位区域
function drawSlots() {
  const slotAreaY = windowHeight - CARD_SIZE - 80;
  const slotAreaWidth = SLOT_COUNT * (CARD_SIZE + CARD_GAP) - CARD_GAP;
  const startX = (windowWidth - slotAreaWidth) / 2;

  // 槽位背景
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 5;

  const woodGradient = ctx.createLinearGradient(startX - 20, slotAreaY - 20, startX - 20, slotAreaY + CARD_SIZE + 20);
  woodGradient.addColorStop(0, '#8B4513');
  woodGradient.addColorStop(0.5, '#A0522D');
  woodGradient.addColorStop(1, '#8B4513');
  ctx.fillStyle = woodGradient;
  roundRect(ctx, startX - 20, slotAreaY - 20, slotAreaWidth + 40, CARD_SIZE + 40, 15);
  ctx.fill();

  ctx.shadowColor = 'transparent';

  const innerGradient = ctx.createLinearGradient(startX - 10, slotAreaY - 10, startX - 10, slotAreaY + CARD_SIZE + 10);
  innerGradient.addColorStop(0, '#DEB887');
  innerGradient.addColorStop(0.5, '#F5DEB3');
  innerGradient.addColorStop(1, '#DEB887');
  ctx.fillStyle = innerGradient;
  roundRect(ctx, startX - 10, slotAreaY - 10, slotAreaWidth + 20, CARD_SIZE + 20, 10);
  ctx.fill();

  ctx.strokeStyle = '#654321';
  ctx.lineWidth = 3;
  roundRect(ctx, startX - 20, slotAreaY - 20, slotAreaWidth + 40, CARD_SIZE + 40, 15);
  ctx.stroke();

  ctx.restore();

  // 空槽位
  for (let i = 0; i < SLOT_COUNT; i++) {
    const slotX = startX + i * (CARD_SIZE + CARD_GAP);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
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
    drawCard(card, true);
  });
}

// 绘制顶部UI
function drawUI() {
  const levelIndex = Math.min(gameState.level - 1, LEVELS.length - 1);
  const levelConfig = LEVELS[levelIndex];

  const headerGradient = ctx.createLinearGradient(0, 0, 0, 80);
  headerGradient.addColorStop(0, 'rgba(255, 107, 53, 0.95)');
  headerGradient.addColorStop(1, 'rgba(255, 217, 61, 0.9)');
  ctx.fillStyle = headerGradient;
  roundRect(ctx, 0, 0, windowWidth, 80, 0);
  ctx.fill();

  // 装饰波浪
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.beginPath();
  ctx.moveTo(0, 75);
  for (let i = 0; i <= windowWidth; i += 20) {
    ctx.lineTo(i, 75 + Math.sin(i * 0.05 + animationFrame * 0.02) * 5);
  }
  ctx.lineTo(windowWidth, 80);
  ctx.lineTo(0, 80);
  ctx.closePath();
  ctx.fill();

  // 标题
  ctx.font = 'bold 22px Arial';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 2;
  ctx.fillText('🍔 吃货大作战 🍕', windowWidth / 2, 28);
  ctx.shadowColor = 'transparent';

  ctx.font = 'bold 14px Arial';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('第' + gameState.level + '关 · ' + levelConfig.name, windowWidth / 2, 50);

  ctx.textAlign = 'left';
  ctx.font = 'bold 16px Arial';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('💰 ' + gameState.score, 15, 70);

  if (gameState.combo > 1) {
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 14px Arial';
    ctx.fillText('🔥 x' + gameState.combo, 15, 50);
  }

  const remainingCards = gameState.cards.filter(function(c) { return !c.collected && !c.isAnimating; }).length;
  ctx.textAlign = 'right';
  ctx.font = 'bold 16px Arial';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('剩余: ' + remainingCards, windowWidth - 15, 70);

  ctx.font = 'bold 14px Arial';
  ctx.fillStyle = gameState.slots.length >= 6 ? '#FF6B6B' : '#FFFFFF';
  ctx.fillText('槽位: ' + gameState.slots.length + '/' + SLOT_COUNT, windowWidth - 15, 50);
}

// 绘制背景
function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, windowHeight);
  gradient.addColorStop(0, '#FFE5B4');
  gradient.addColorStop(0.5, '#FFDAB9');
  gradient.addColorStop(1, '#FFE4C4');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, windowWidth, windowHeight);

  ctx.globalAlpha = 0.08;
  ctx.font = '60px Arial';
  ctx.textAlign = 'center';

  const decorations = ['🍕', '🍔', '🍟', '🍩', '🍪', '🧁', '🍰', '🍫'];
  for (let i = 0; i < 8; i++) {
    const x = (i * 47 + 30) % windowWidth;
    const y = (i * 83 + 100) % (windowHeight - 200) + 100;
    ctx.fillText(decorations[i], x, y);
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = 'rgba(255, 200, 100, 0.3)';
  ctx.beginPath();
  ctx.moveTo(0, windowHeight);
  ctx.quadraticCurveTo(windowWidth / 2, windowHeight - 50, windowWidth, windowHeight);
  ctx.lineTo(windowWidth, windowHeight);
  ctx.lineTo(0, windowHeight);
  ctx.closePath();
  ctx.fill();
}

// 绘制粒子效果
function drawParticles() {
  gameState.particles = gameState.particles.filter(function(p) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.25;
    p.life -= 0.018;
    p.size *= 0.97;

    if (p.life <= 0 || p.size < 0.5) return false;

    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    return true;
  });
}

// 创建消除粒子 - 更爆炸
function createEliminateParticles(x, y, color) {
  for (let i = 0; i < 25; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 6;
    gameState.particles.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 3,
      size: Math.random() * 8 + 4,
      color: color,
      life: 1
    });
  }

  // 添加闪光粒子
  for (let i = 0; i < 8; i++) {
    gameState.particles.push({
      x: x + (Math.random() - 0.5) * 40,
      y: y + (Math.random() - 0.5) * 40,
      vx: 0,
      vy: -1,
      size: Math.random() * 4 + 2,
      color: '#FFFFFF',
      life: 0.7
    });
  }
}

// 绘制飘字
function drawFloatingTexts() {
  gameState.floatingTexts = gameState.floatingTexts.filter(function(t) {
    t.y -= 2.5;
    t.life -= 0.015;
    t.scale = t.scale !== undefined ? t.scale : 1;

    if (t.life <= 0) return false;

    ctx.save();
    ctx.globalAlpha = t.life;
    ctx.translate(t.x, t.y);
    ctx.scale(t.scale, t.scale);
    ctx.font = 'bold ' + t.size + 'px Arial';
    ctx.fillStyle = t.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    ctx.fillText(t.text, 0, 0);
    ctx.restore();
    ctx.globalAlpha = 1;

    return true;
  });
}

// 创建飘字 - 更绚丽
function createFloatingText(x, y, text, color, size) {
  gameState.floatingTexts.push({
    x: x,
    y: y,
    text: text,
    color: color || '#FFD700',
    size: size || 24,
    life: 1,
    scale: 1.2
  });
}

// 绘制庆祝粒子（胜利时）
function drawCelebrateParticles() {
  gameState.celebrateParticles = gameState.celebrateParticles.filter(function(p) {
    p.y += p.vy;
    p.x += p.vx;
    p.vy += 0.15;
    p.life -= 0.008;

    if (p.life <= 0) return false;

    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.font = p.size + 'px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(p.emoji, p.x, p.y);
    ctx.globalAlpha = 1;

    return true;
  });
}

// 创建庆祝效果
function createCelebration() {
  const emojis = ['🎉', '🎊', '⭐', '🌟', '✨', '💫'];
  const colors = ['#FFD700', '#FF6B6B', '#4CAF50', '#FF69B4', '#87CEEB'];

  for (let i = 0; i < 30; i++) {
    const emoji = emojis[Math.floor(Math.random() * emojis.length)];
    gameState.celebrateParticles.push({
      x: Math.random() * windowWidth,
      y: windowHeight + 50,
      vx: (Math.random() - 0.5) * 4,
      vy: -(5 + Math.random() * 8),
      emoji: emoji,
      size: 24 + Math.random() * 20,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 1
    });
  }

  for (let i = 0; i < 50; i++) {
    gameState.particles.push({
      x: Math.random() * windowWidth,
      y: windowHeight,
      vx: (Math.random() - 0.5) * 6,
      vy: -(8 + Math.random() * 6),
      size: Math.random() * 6 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 1
    });
  }
}

// 绘制游戏结束画面
function drawGameOver() {
  if (gameState.gameStatus === 'win') {
    drawCelebrateParticles();
  }

  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.fillRect(0, 0, windowWidth, windowHeight);

  const boxWidth = windowWidth * 0.85;
  const boxHeight = 280;
  const boxX = (windowWidth - boxWidth) / 2;
  const boxY = (windowHeight - boxHeight) / 2;

  const boxGradient = ctx.createLinearGradient(boxX, boxY, boxX, boxY + boxHeight);
  boxGradient.addColorStop(0, '#FFFFFF');
  boxGradient.addColorStop(1, '#F5F5F5');
  ctx.fillStyle = boxGradient;
  roundRect(ctx, boxX, boxY, boxWidth, boxHeight, 25);
  ctx.fill();

  ctx.strokeStyle = gameState.gameStatus === 'win' ? '#4CAF50' : '#FF6B6B';
  ctx.lineWidth = 4;
  roundRect(ctx, boxX, boxY, boxWidth, boxHeight, 25);
  ctx.stroke();

  ctx.font = '60px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(gameState.gameStatus === 'win' ? '🎉' : '😢', windowWidth / 2, boxY + 70);

  ctx.font = 'bold 28px Arial';
  ctx.fillStyle = gameState.gameStatus === 'win' ? '#4CAF50' : '#FF6B6B';
  ctx.fillText(gameState.gameStatus === 'win' ? '恭喜过关！' : '再接再厉！', windowWidth / 2, boxY + 120);

  ctx.font = '18px Arial';
  ctx.fillStyle = '#666666';
  ctx.fillText('本次得分', windowWidth / 2, boxY + 155);

  ctx.font = 'bold 36px Arial';
  ctx.fillStyle = '#FF6B35';
  ctx.fillText(gameState.score.toString(), windowWidth / 2, boxY + 195);

  const btnY = boxY + boxHeight - 50;
  const btnGradient = ctx.createLinearGradient(boxX + 30, btnY - 20, boxX + boxWidth - 30, btnY);
  btnGradient.addColorStop(0, '#FF6B35');
  btnGradient.addColorStop(1, '#FFD93D');
  ctx.fillStyle = btnGradient;
  roundRect(ctx, boxX + 30, btnY - 25, boxWidth - 60, 45, 22);
  ctx.fill();

  ctx.font = 'bold 18px Arial';
  ctx.fillStyle = '#FFFFFF';
  if (gameState.gameStatus === 'win') {
    ctx.fillText('👆 继续挑战下一关', windowWidth / 2, btnY);
  } else {
    ctx.fillText('👆 重新开始', windowWidth / 2, btnY);
  }
}

// 主渲染循环
function render() {
  animationFrame++;

  drawBackground();
  drawUI();

  // 绘制场上的卡片
  gameState.cards.forEach(function(card) {
    if (!card.collected && !card.isAnimating) {
      drawCard(card, false);
    }
  });

  drawSlots();
  drawFlyCards();
  drawClickEffects();
  drawParticles();
  drawFloatingTexts();

  if (gameState.gameStatus !== 'playing') {
    drawGameOver();
  }

  requestAnimationFrame(render);
}

// 检查消除
function checkMatch() {
  const typeCounts = {};

  gameState.slots.forEach(function(card, index) {
    if (!typeCounts[card.type]) {
      typeCounts[card.type] = [];
    }
    typeCounts[card.type].push(index);
  });

  let hasMatch = false;
  Object.keys(typeCounts).forEach(function(type) {
    if (typeCounts[type].length >= MATCH_COUNT) {
      hasMatch = true;
      const indicesToRemove = typeCounts[type].slice(0, MATCH_COUNT).sort(function(a, b) { return b - a; });

      const slotAreaY = windowHeight - CARD_SIZE - 80;
      const slotAreaWidth = SLOT_COUNT * (CARD_SIZE + CARD_GAP) - CARD_GAP;
      const startX = (windowWidth - slotAreaWidth) / 2;

      indicesToRemove.forEach(function(index) {
        const slotX = startX + index * (CARD_SIZE + CARD_GAP);
        const card = gameState.slots[index];
        createEliminateParticles(slotX + CARD_SIZE / 2, slotAreaY + CARD_SIZE / 2, card.food.color);
      });

      indicesToRemove.forEach(function(index) {
        gameState.slots.splice(index, 1);
      });

      gameState.totalEliminated += MATCH_COUNT;
    }
  });

  return hasMatch;
}

// 检查游戏状态
function checkGameState() {
  const remainingCards = gameState.cards.filter(function(c) { return !c.collected && !c.isAnimating; }).length;

  if (remainingCards === 0 && gameState.slots.length === 0) {
    gameState.gameStatus = 'win';
    gameState.score += 500;
    createCelebration();
    return;
  }

  if (gameState.slots.length >= SLOT_COUNT) {
    const typeCounts = {};
    gameState.slots.forEach(function(card) {
      typeCounts[card.type] = (typeCounts[card.type] || 0) + 1;
    });

    let canMatch = false;
    Object.keys(typeCounts).forEach(function(type) {
      if (typeCounts[type] >= MATCH_COUNT) {
        canMatch = true;
      }
    });

    if (!canMatch) {
      gameState.gameStatus = 'lose';
    }
  }
}

// 收集卡片 - 带动画
function collectCard(card) {
  const now = Date.now();

  // 防止双击
  if (now - gameState.lastClickTime < 150) return;
  gameState.lastClickTime = now;

  card.collected = true;

  const slotAreaY = windowHeight - CARD_SIZE - 80;
  const slotAreaWidth = SLOT_COUNT * (CARD_SIZE + CARD_GAP) - CARD_GAP;
  const startX = (windowWidth - slotAreaWidth) / 2;
  const targetSlotIndex = gameState.slots.length;
  const endX = startX + targetSlotIndex * (CARD_SIZE + CARD_GAP);

  // 点击涟漪效果
  gameState.clickEffects.push({
    x: card.x + CARD_SIZE / 2,
    y: card.y + CARD_SIZE / 2,
    radius: 10,
    alpha: 0.8,
    color: card.food.color
  });

  // 飞入动画
  gameState.flyCards.push({
    card: card,
    startX: card.x,
    startY: card.y,
    endX: endX,
    endY: slotAreaY,
    startRotation: card.rotation,
    progress: 0,
    currentX: card.x,
    currentY: card.y,
    rotation: card.rotation
  });

  // 延迟检查消除
  setTimeout(function() {
    const matched = checkMatch();

    if (matched) {
      gameState.combo++;
      const bonus = 100 * gameState.combo;
      gameState.score += bonus;

      const slotAreaY = windowHeight - CARD_SIZE - 80;
      createFloatingText(
        windowWidth / 2,
        slotAreaY - 30,
        '+' + bonus + (gameState.combo > 1 ? ' x' + gameState.combo : ''),
        '#FFD700',
        28
      );
    } else {
      gameState.combo = 0;
    }

    checkGameState();
  }, 400);
}

// 点击处理
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
    if (card.collected || card.isAnimating) continue;

    if (
      clientX >= card.x &&
      clientX <= card.x + CARD_SIZE &&
      clientY >= card.y &&
      clientY <= card.y + CARD_SIZE
    ) {
      let isBlocked = false;
      for (let j = 0; j < gameState.cards.length; j++) {
        const otherCard = gameState.cards[j];
        if (i === j || otherCard.collected || otherCard.isAnimating || otherCard.layer <= card.layer) continue;

        if (
          otherCard.x < card.x + CARD_SIZE &&
          otherCard.x + CARD_SIZE > card.x &&
          otherCard.y < card.y + CARD_SIZE &&
          otherCard.y + CARD_SIZE > card.y
        ) {
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

// 注册点击事件
wx.onTouchStart(function(event) {
  const touch = event.touches[0];
  handleClick({ clientX: touch.clientX, clientY: touch.clientY });
});

// 启动游戏
initGame(1);
render();

console.log('🍔 吃货大作战 v3.0 - 动效增强版 已启动！');
console.log('📱 屏幕尺寸:', windowWidth, 'x', windowHeight);
