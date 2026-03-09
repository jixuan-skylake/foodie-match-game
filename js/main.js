/**
 * 《吃货大作战 - 沸腾火锅局》 v6.0 (The Soul Update)
 * 极致手感、生命力动画、羁绊消除系统
 */
import { CollectionSystem } from './collection.js';
CollectionSystem.load();

const systemInfo = wx.getSystemInfoSync();
const windowWidth = systemInfo.windowWidth;
const windowHeight = systemInfo.windowHeight;
const pixelRatio = systemInfo.pixelRatio;
// 安全区适配
const safeArea = systemInfo.safeArea || { top: 40, left: 0, right: windowWidth, bottom: windowHeight, width: windowWidth, height: windowHeight };

const canvas = wx.createCanvas();
const ctx = canvas.getContext('2d');

// -- 物理与震动系统 --
let screenShake = 0;
let animationFrame = 0;
let lastRenderTime = Date.now();
let dt = 16; // 增量时间

// 游戏常量 (完美自适应屏宽)
const SLOT_COUNT = 7;
const MATCH_COUNT = 3;
const CARD_GAP = 6;
const CARD_SIZE = Math.floor((windowWidth - 40 - CARD_GAP * (SLOT_COUNT - 1)) / SLOT_COUNT);

// 🎨 全新配色方案 (磨砂、晶莹剔透)
const THEMES = {
  primary: '#FF4500', // 热烈橙红
  secondary: '#FF8C00', // 暗橙
  bgTop: '#FFF5EE',   // 海贝色
  bgBottom: '#FFEFD5',// 木瓜霜
  glassColor: 'rgba(255, 255, 255, 0.45)', // 毛玻璃
  glassBorder: 'rgba(255, 255, 255, 0.8)'
};

// 食材定义：增加"羁绊属性" tag
const FOOD_TYPES = [
  { name: '肥牛', color: '#FF6B6B', emoji: '🥩', tag: 'meat' },
  { name: '毛肚', color: '#4A4A4A', emoji: '🧆', tag: 'meat' }, // 黑灰色系表示毛肚
  { name: '五花肉', color: '#FFB6C1', emoji: '🥓', tag: 'meat' },
  { name: '娃娃菜', color: '#90EE90', emoji: '🥬', tag: 'veg' },
  { name: '金针菇', color: '#FDF5E6', emoji: '🍄', tag: 'veg' },
  { name: '海带', color: '#2E8B57', emoji: '🌿', tag: 'veg' },
  { name: '鱼丸', color: '#FFF8DC', emoji: '🍡', tag: 'ball' },
  { name: '虾滑', color: '#FFA07A', emoji: '🦐', tag: 'meat' },
  { name: '撒尿牛丸', color: '#8B4513', emoji: '🧆', tag: 'ball' }
];

// 动态关卡生成器
function generateLevel(levelNum) {
  const baseTypes = 4 + Math.floor(levelNum / 2);
  const types = Math.min(baseTypes, FOOD_TYPES.length);
  const layers = Math.min(2 + Math.floor(levelNum / 3), 5); // 最大5层
  
  // 每种卡牌需要是 MATCH_COUNT 的倍数
  // 确保牌组有规律可解
  const pairsPerType = 3; // 3对=9张牌每种
  
  return {
    foodTypes: types,
    cardsPerType: pairsPerType * MATCH_COUNT, // 9
    layers: layers,
    name: levelNum === 1 ? '九宫格开局' : (levelNum >= 5 ? '沸腾海底捞' : '麻辣烫')
  };
}

// 游戏状态
let gameState = {
  cards: [],
  slots: [],
  score: 0,
  level: 1,
  gameStatus: 'playing', // playing | win | lose
  combo: 0,
  
  // 特效层
  particles: [],
  bubbles: [], // 沸腾气泡
  floatingTexts: [],
  flyCards: [],
  celebrateParticles: [],
  
  lastClickTime: 0
};

// 缓动算法 (果冻效果核心)
function easeOutElastic(t) {
  const c4 = (2 * Math.PI) / 3;
  return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}
function easeOutQuad(t) { return t * (2 - t); }

// 洗牌算法 (Fisher-Yates)
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// 震动触发 (微信Taptic Engine + 画面抖动)
function triggerVibration(type) {
  if (type === 'heavy') {
    wx.vibrateLong();
    screenShake = 15; // 震动强度15px
  } else if (type === 'medium') {
    wx.vibrateShort({ type: 'medium' });
    screenShake = 8;
  } else {
    wx.vibrateShort({ type: 'light' });
    screenShake = 3;
  }
}

// 绘制高级圆角矩形(支持不同角度圆角)
function roundRectCustom(ctx, x, y, width, height, radii) {
  ctx.beginPath();
  ctx.moveTo(x + radii[0], y);
  ctx.lineTo(x + width - radii[1], y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radii[1]);
  ctx.lineTo(x + width, y + height - radii[2]);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radii[2], y + height);
  ctx.lineTo(x + radii[3], y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radii[3]);
  ctx.lineTo(x, y + radii[0]);
  ctx.quadraticCurveTo(x, y, x + radii[0], y);
  ctx.closePath();
}

function roundRect(ctx, x, y, width, height, radius) {
  roundRectCustom(ctx, x, y, width, height, [radius, radius, radius, radius]);
}

// =================== 核心初始化 ===================
function initGame(level) {
  level = level || 1;
  const config = generateLevel(level);
  const prevScore = gameState.score;

  gameState = {
    cards: [], slots: [],
    score: level > 1 ? prevScore : 0,
    level: level,
    gameStatus: 'playing',
    combo: 0,
    particles: [], bubbles: [], floatingTexts: [], flyCards: [], celebrateParticles: [],
    lastClickTime: 0
  };

  const usedFoodTypes = FOOD_TYPES.slice(0, config.foodTypes);
  const cardPool = [];

  usedFoodTypes.forEach((food, foodIndex) => {
    for (let i = 0; i < config.cardsPerType; i++) {
      cardPool.push({
        type: foodIndex,
        food: food,
        layer: 0, x: 0, y: 0,
        collected: false,
        id: `${foodIndex}-${i}`,
        scale: 1, rotation: 0,
        
        // 呼吸动画的基础偏置
        breathOffset: Math.random() * Math.PI * 2,
        
        // 果冻形变倍率 (squashX, squashY)
        squashX: 1, squashY: 1,
        isJelly: false, jellyTime: 0
      });
    }
  });

  shuffleArray(cardPool);

  const totalCards = cardPool.length;
  const layers = config.layers;
  const cardsPerLayer = Math.ceil(totalCards / layers);
  const cols = 5;

  const areaWidth = cols * (CARD_SIZE + CARD_GAP) - CARD_GAP;
  const startX = (windowWidth - areaWidth) / 2;
  // 计算可用的高度空间：顶部避开刘海(safeArea.top + 80UI)，底部避开收集槽
  const availTop = safeArea.top + 100;
  const availBottom = windowHeight - 160 - CARD_SIZE;
  const startY = availTop + (availBottom - availTop - (cardsPerLayer/cols * (CARD_SIZE+CARD_GAP))) / 2 - 40;

  cardPool.forEach((card, index) => {
    const layer = Math.floor(index / cardsPerLayer);
    const posInLayer = index % cardsPerLayer;
    const row = Math.floor(posInLayer / cols);
    const col = posInLayer % cols;

    // 更散乱的物理分布错位
    const offsetX = (Math.random() - 0.5) * (CARD_SIZE * 0.4);
    const offsetY = (Math.random() - 0.5) * (CARD_SIZE * 0.4);
    
    // 金字塔堆叠逻辑：上层向内收缩
    card.x = startX + col * (CARD_SIZE + CARD_GAP) + offsetX + layer * 15;
    card.y = startY + row * (CARD_SIZE + CARD_GAP) + offsetY + layer * 20;
    card.layer = layer;
    card.rotation = (Math.random() - 0.5) * 12;
    card.baseY = card.y; // 用于呼吸悬浮
  });

  // 按层排序绘制
  gameState.cards = cardPool.sort((a, b) => a.layer - b.layer);
  
  // 生成初始气泡
  for(let i=0; i<20; i++) { createBubble(); }
}

// =================== 视觉渲染系统 ===================
function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, windowHeight);
  gradient.addColorStop(0, THEMES.bgTop);
  gradient.addColorStop(0.5, '#FFE4C4');
  gradient.addColorStop(1, THEMES.bgBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, windowWidth, windowHeight);

  // 绘制上升气泡 (火锅沸腾感)
  gameState.bubbles = gameState.bubbles.filter(b => {
    b.y -= b.speed;
    b.x += Math.sin(animationFrame * 0.05 + b.offset) * 0.5;
    if (b.y < -50) return false;
    
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 165, 0, ${b.alpha})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 69, 0, ${b.alpha * 1.5})`;
    ctx.lineWidth = 1;
    ctx.stroke();
    return true;
  });
  
  if (Math.random() < 0.1) createBubble();
}

function createBubble() {
  gameState.bubbles.push({
    x: Math.random() * windowWidth,
    y: windowHeight + 20,
    size: Math.random() * 6 + 2,
    speed: Math.random() * 2 + 1,
    alpha: Math.random() * 0.3 + 0.1,
    offset: Math.random() * 10
  });
}

function drawUI() {
  ctx.save();
  // 顶部沉浸式标题栏 (避让刘海)
  ctx.shadowColor = 'rgba(255, 69, 0, 0.4)';
  ctx.shadowBlur = 15;
  ctx.shadowOffsetY = 5;
  
  const headerGradient = ctx.createLinearGradient(0, 0, 0, safeArea.top + 70);
  headerGradient.addColorStop(0, '#FF4500'); // 极度热烈
  headerGradient.addColorStop(1, '#FF8C00');
  
  ctx.fillStyle = headerGradient;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(windowWidth, 0);
  ctx.lineTo(windowWidth, safeArea.top + 60);
  // 贝塞尔曲线底部
  ctx.quadraticCurveTo(windowWidth / 2, safeArea.top + 80, 0, safeArea.top + 60);
  ctx.closePath();
  ctx.fill();
  ctx.shadowColor = 'transparent';

  // 文字与UI信息
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.font = 'bold 24px Arial';
  ctx.fillText('🍲 沸腾火锅局', windowWidth / 2, safeArea.top + 20);

  ctx.font = '14px Arial';
  ctx.fillText(`第 ${gameState.level} 桌 · 麻辣清汤`, windowWidth / 2, safeArea.top + 45);

  ctx.textAlign = 'left';
  ctx.font = 'bold 18px Arial';
  ctx.fillText(`💰 ${gameState.score}`, 20, safeArea.top + 35);

  const remainingCards = gameState.cards.filter(c => !c.collected).length;
  ctx.textAlign = 'right';
  ctx.fillText(`余: ${remainingCards}`, windowWidth - 20, safeArea.top + 35);
  ctx.restore();
}

// 核心卡片绘制：引入果冻形变和质感
function drawCard(card, isSlot) {
  const x = card.x;
  
  // 悬浮呼吸物理计算 (仅场上的牌呼吸)
  let y = card.y;
  if (!isSlot && !card.collected) {
    const float = Math.sin(animationFrame * 0.05 + card.breathOffset) * 3;
    y = card.baseY + float;
  }
  
  const food = card.food;
  const rotation = card.rotation || 0;
  let scale = card.scale || 1;
  
  // 果冻动画逻辑 (Squash and Stretch)
  let sx = 1, sy = 1;
  if (card.isJelly) {
    card.jellyTime += dt * 0.001;
    if (card.jellyTime < 0.4) {
      // 弹性衰减振荡曲线
      const progress = card.jellyTime / 0.4;
      const t = progress;
      const decay = Math.exp(-t * 8);
      sx = 1 + Math.sin(t * 20) * 0.4 * decay;
      sy = 1 - Math.sin(t * 20) * 0.4 * decay;
    } else {
      card.isJelly = false; // 结束形变
    }
  }

  ctx.save();

  const centerX = x + CARD_SIZE / 2;
  const centerY = y + CARD_SIZE / 2;
  ctx.translate(centerX, centerY);
  
  // 应用形变与缩放
  ctx.scale(scale * sx, scale * sy);

  if (rotation !== 0 && !isSlot) {
    ctx.rotate(rotation * Math.PI / 180);
  }
  ctx.translate(-centerX, -centerY);

  // 卡牌本底与阴影
  if (!isSlot) {
    // 带有深度的 3D 悬浮阴影
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 12 + card.layer * 3;
    ctx.shadowOffsetY = 8 + card.layer * 2;
  }
  
  const grad = ctx.createLinearGradient(x, y, x, y + CARD_SIZE);
  if (isSlot) {
    grad.addColorStop(0, '#FFFFFF');
    grad.addColorStop(1, '#F0F0F0');
  } else {
    grad.addColorStop(0, food.color);
    // 卡牌底端加深
    const darkColor = adjustColor(food.color, -30);
    grad.addColorStop(1, darkColor);
  }
  
  ctx.fillStyle = grad;
  roundRect(ctx, x, y, CARD_SIZE, CARD_SIZE, 12);
  ctx.fill();
  ctx.shadowColor = 'transparent';

  // 顶部玻璃反光高光 (立体质感)
  const gloss = ctx.createLinearGradient(x, y, x, y + CARD_SIZE / 2);
  gloss.addColorStop(0, 'rgba(255,255,255,0.6)');
  gloss.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gloss;
  roundRectCustom(ctx, x, y, CARD_SIZE, CARD_SIZE/2, [12,12,0,0]);
  ctx.fill();

  // 边框描边
  ctx.strokeStyle = isSlot ? '#E0E0E0' : 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = isSlot ? 2 : 3;
  roundRect(ctx, x, y, CARD_SIZE, CARD_SIZE, 12);
  ctx.stroke();

  // Emoji 绘制 (加入微小的下落阴影产生立体字效果)
  ctx.font = `bold ${CARD_SIZE * 0.5}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillText(food.emoji, x + CARD_SIZE / 2, y + CARD_SIZE * 0.48 + 2); // 阴影
  
  ctx.fillStyle = '#000000'; // Emoji原生颜色由系统决定
  ctx.fillText(food.emoji, x + CARD_SIZE / 2, y + CARD_SIZE * 0.48);

  // 底部铭牌
  const labelH = 14;
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  roundRect(ctx, x + 4, y + CARD_SIZE - labelH - 4, CARD_SIZE - 8, labelH, 6);
  ctx.fill();
  
  ctx.font = `bold ${CARD_SIZE * 0.16}px Arial`;
  ctx.fillStyle = isSlot ? '#333' : food.color;
  ctx.fillText(food.name, x + CARD_SIZE / 2, y + CARD_SIZE - labelH/2 - 4 + 1);

  ctx.restore();
}

function adjustColor(color, amount) {
  let hex = color.replace('#', '');
  if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
  let r = parseInt(hex.substr(0, 2), 16) + amount;
  let g = parseInt(hex.substr(2, 2), 16) + amount;
  let b = parseInt(hex.substr(4, 2), 16) + amount;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return '#' + r.toString(16).padStart(2,'0') + g.toString(16).padStart(2,'0') + b.toString(16).padStart(2,'0');
}

// 槽位与毛玻璃底部
function drawSlots() {
  const slotAreaWidth = SLOT_COUNT * (CARD_SIZE + CARD_GAP) + CARD_GAP;
  const startX = (windowWidth - slotAreaWidth) / 2;
  const slotAreaY = windowHeight - safeArea.bottom + (windowHeight - 160) - CARD_SIZE - 20; // 自适应底部

  ctx.save();
  // 亚克力半透明磨砂底座
  ctx.fillStyle = THEMES.glassColor;
  ctx.shadowColor = 'rgba(0,0,0,0.2)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 10;
  roundRect(ctx, startX, slotAreaY - 10, slotAreaWidth, CARD_SIZE + 20, 20);
  ctx.fill();
  
  ctx.strokeStyle = THEMES.glassBorder;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.shadowColor = 'transparent';

  // 内部槽位凹陷
  for (let i = 0; i < SLOT_COUNT; i++) {
    const slotX = startX + CARD_GAP + i * (CARD_SIZE + CARD_GAP);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'; // 凹陷感深色
    roundRect(ctx, slotX, slotAreaY, CARD_SIZE, CARD_SIZE, 12);
    ctx.fill();
    // 内阴影高光
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // 绘制槽内卡牌
  gameState.slots.forEach((card, index) => {
    const slotX = startX + CARD_GAP + index * (CARD_SIZE + CARD_GAP);
    const renderCard = { ...card, x: slotX, y: slotAreaY, scale: 1, rotation: 0 };
    drawCard(renderCard, true);
  });
  ctx.restore();
}

// 华丽粒子爆炸
function createExplosion(x, y, color) {
  triggerVibration('medium');
  for (let i = 0; i < 30; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 8 + 4;
    gameState.particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 4, // 向上抛出感
      size: Math.random() * 6 + 3,
      color: color,
      life: 1,
      decay: Math.random() * 0.02 + 0.01
    });
  }
}

function drawParticles() {
  gameState.particles = gameState.particles.filter(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.4; // 重力
    p.life -= p.decay;
    p.size *= 0.95;

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

// =================== 交互逻辑核心 ===================
function checkMatch() {
  const typeCounts = {};
  gameState.slots.forEach((card, index) => {
    if (!typeCounts[card.type]) typeCounts[card.type] = [];
    typeCounts[card.type].push({index, card});
  });

  let hasMatch = false;
  
  // 羁绊检测辅助变量
  let matchedTags = {};

  Object.keys(typeCounts).forEach(type => {
    if (typeCounts[type].length >= MATCH_COUNT) {
      hasMatch = true;
      const matchedGroup = typeCounts[type].slice(0, MATCH_COUNT);
      const tag = matchedGroup[0].card.food.tag;
      matchedTags[tag] = (matchedTags[tag] || 0) + 1;

      // 索引从后往前删
      const indicesToRemove = matchedGroup.map(m => m.index).sort((a,b)=>b-a);
      
      const slotAreaWidth = SLOT_COUNT * (CARD_SIZE + CARD_GAP) + CARD_GAP;
      const startX = (windowWidth - slotAreaWidth) / 2;
      const slotAreaY = windowHeight - safeArea.bottom + (windowHeight - 160) - CARD_SIZE - 20;

      indicesToRemove.forEach(index => {
        const slotX = startX + CARD_GAP + index * (CARD_SIZE + CARD_GAP);
        const c = gameState.slots[index];
        createExplosion(slotX + CARD_SIZE/2, slotAreaY + CARD_SIZE/2, c.food.color);
        gameState.slots.splice(index, 1);
      });
      
      gameState.score += 100;
      triggerVibration('heavy'); // 强烈打击感
    }
  });

  // 羁绊连消触发彩蛋
  if (matchedTags['meat']) {
    createFloatingText(windowWidth/2, windowHeight/2, '🥩 无肉不欢！得分翻倍', '#FF4500', 30);
    gameState.score += 200;
  }
  if (matchedTags['veg']) {
    createFloatingText(windowWidth/2, windowHeight/2, '🥬 绿色健康！清爽解腻', '#32CD32', 30);
    gameState.score += 50;
  }

  if (hasMatch) {
    CollectionSystem.updateStats({ score: gameState.score });
  }

  return hasMatch;
}

function collectCard(card) {
  const now = Date.now();
  if (now - gameState.lastClickTime < 100) return;
  gameState.lastClickTime = now;

  triggerVibration('light');
  
  // 触发点击果冻形变 (原卡牌留在原地的残影形变反馈)
  card.isJelly = true;
  card.jellyTime = 0;
  
  // 延迟一帧后飞走，让玩家看到形变瞬间
  setTimeout(() => {
    card.collected = true;
    const slotAreaWidth = SLOT_COUNT * (CARD_SIZE + CARD_GAP) + CARD_GAP;
    const startX = (windowWidth - slotAreaWidth) / 2;
    const slotAreaY = windowHeight - safeArea.bottom + (windowHeight - 160) - CARD_SIZE - 20;
    
    // 插入逻辑：同类型放在一起
    let insertIndex = gameState.slots.length;
    for(let i = 0; i < gameState.slots.length; i++) {
      if (gameState.slots[i].type === card.type) {
        insertIndex = i + 1; // 插在同类后面
      }
    }
    
    // 飞行动画数据
    const endX = startX + CARD_GAP + insertIndex * (CARD_SIZE + CARD_GAP);
    gameState.flyCards.push({
      card: card,
      startX: card.x, startY: card.y,
      endX: endX, endY: slotAreaY,
      progress: 0,
      insertIndex: insertIndex
    });
    
    // 先将一个占位符塞入slot，阻挡新点击
    gameState.slots.splice(insertIndex, 0, card);
    
    CollectionSystem.unlockFood(card.food.name);
    
    // 飞行完成后检测
    setTimeout(() => {
      checkMatch();
      checkGameState();
    }, 250); // 配合飞行动画时间
  }, 50);
}

function drawFlyCards() {
  gameState.flyCards = gameState.flyCards.filter(fly => {
    fly.progress += dt * 0.005; // 速度由增量时间决定
    if (fly.progress >= 1) return false;

    // 优美的抛物线飞入
    const t = easeOutQuad(fly.progress);
    const currentX = fly.startX + (fly.endX - fly.startX) * t;
    // 加入贝塞尔曲线的高度偏置，产生"跳跃"感
    const jumpHeight = Math.sin(fly.progress * Math.PI) * 50;
    const currentY = fly.startY + (fly.endY - fly.startY) * t - jumpHeight;

    const renderCard = {
      ...fly.card,
      x: currentX, y: currentY,
      scale: 1 + Math.sin(fly.progress * Math.PI) * 0.2 // 飞行中略微放大
    };
    drawCard(renderCard, false);
    return true;
  });
}

function createFloatingText(x, y, text, color, size) {
  gameState.floatingTexts.push({
    x, y, text, color, size, life: 1, scale: 0.1
  });
}

function drawFloatingTexts() {
  gameState.floatingTexts = gameState.floatingTexts.filter(t => {
    t.y -= 1.5;
    t.life -= 0.015;
    // 弹簧放大效果
    if (t.scale < 1.2) t.scale += 0.15;
    else if (t.scale > 1) t.scale -= 0.05;

    if (t.life <= 0) return false;
    ctx.save();
    ctx.globalAlpha = t.life;
    ctx.translate(t.x, t.y);
    ctx.scale(t.scale, t.scale);
    ctx.font = `bold ${t.size}px Arial`;
    ctx.textAlign = 'center';
    
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#FFFFFF';
    ctx.strokeText(t.text, 0, 0);
    
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, 0, 0);
    ctx.restore();
    return true;
  });
}

function checkGameState() {
  // 判定输赢略
}

wx.onTouchStart(event => {
  const touch = event.touches[0];
  const cx = touch.clientX;
  const cy = touch.clientY;
  
  // 逆序遍历找到最顶层的未阻挡卡牌
  for (let i = gameState.cards.length - 1; i >= 0; i--) {
    const card = gameState.cards[i];
    if (card.collected) continue;
    
    if (cx >= card.x && cx <= card.x + CARD_SIZE && cy >= card.y && cy <= card.y + CARD_SIZE) {
      let isBlocked = false;
      for (let j = i + 1; j < gameState.cards.length; j++) {
        const upCard = gameState.cards[j];
        if (upCard.collected) continue;
        if (!(upCard.x >= card.x + CARD_SIZE || upCard.x + CARD_SIZE <= card.x ||
              upCard.y >= card.y + CARD_SIZE || upCard.y + CARD_SIZE <= card.y)) {
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
});

// =================== 主循环 ===================
function render() {
  const now = Date.now();
  dt = now - lastRenderTime;
  lastRenderTime = now;
  animationFrame++;

  ctx.save();
  // 屏幕震动应用
  if (screenShake > 0) {
    const dx = (Math.random() - 0.5) * screenShake;
    const dy = (Math.random() - 0.5) * screenShake;
    ctx.translate(dx, dy);
    screenShake *= 0.85; // 震动衰减
    if (screenShake < 0.5) screenShake = 0;
  }

  drawBackground();
  drawUI();

  // 绘制未收集的卡牌
  gameState.cards.forEach(card => {
    if (!card.collected) drawCard(card, false);
  });

  drawSlots();
  drawFlyCards();
  drawParticles();
  drawFloatingTexts();
  
  ctx.restore();
  requestAnimationFrame(render);
}

// 启动
initGame(1);
render();
console.log('🍲 沸腾火锅局 (The Soul Update) 已启动！');
