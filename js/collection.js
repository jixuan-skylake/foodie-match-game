/**
 * 收集系统管理模块
 */
export const CollectionSystem = {
  // 存档数据
  data: {
    unlockedFoods: {}, // 已解锁的美食 id: boolean
    achievements: {},  // 已获得的成就 id: boolean
    stats: {
      totalScore: 0,
      totalEliminated: 0,
      maxCombo: 0,
      gamesPlayed: 0,
      gamesWon: 0
    }
  },

  // 成就定义
  achievementsList: [
    { id: 'first_blood', name: '初入江湖', desc: '完成第一次消除', icon: '🎯' },
    { id: 'combo_master', name: '连击达人', desc: '达成5连击', icon: '🔥' },
    { id: 'foodie_king', name: '吃货之王', desc: '单局得分超过3000', icon: '👑' },
    { id: 'collector', name: '美食收藏家', desc: '解锁所有美食', icon: '📚' }
  ],

  // 加载存档
  load() {
    try {
      const saved = wx.getStorageSync('foodie_collection');
      if (saved) {
        this.data = JSON.parse(saved);
      }
    } catch (e) {
      console.error('加载存档失败', e);
    }
  },

  // 保存存档
  save() {
    try {
      wx.setStorageSync('foodie_collection', JSON.stringify(this.data));
    } catch (e) {
      console.error('保存存档失败', e);
    }
  },

  // 解锁美食
  unlockFood(foodId) {
    if (!this.data.unlockedFoods[foodId]) {
      this.data.unlockedFoods[foodId] = true;
      this.save();
      return true; // 返回true表示新解锁
    }
    return false;
  },

  // 更新统计数据
  updateStats(stats) {
    if (stats.score) this.data.stats.totalScore += stats.score;
    if (stats.eliminated) this.data.stats.totalEliminated += stats.eliminated;
    if (stats.combo && stats.combo > this.data.stats.maxCombo) {
      this.data.stats.maxCombo = stats.combo;
    }
    if (stats.played) this.data.stats.gamesPlayed++;
    if (stats.won) this.data.stats.gamesWon++;
    
    this.checkAchievements();
    this.save();
  },

  // 检查成就
  checkAchievements() {
    const newAchievements = [];
    
    // 初入江湖
    if (!this.data.achievements['first_blood'] && this.data.stats.totalEliminated >= 3) {
      this.data.achievements['first_blood'] = true;
      newAchievements.push(this.achievementsList.find(a => a.id === 'first_blood'));
    }
    
    // 连击达人
    if (!this.data.achievements['combo_master'] && this.data.stats.maxCombo >= 5) {
      this.data.achievements['combo_master'] = true;
      newAchievements.push(this.achievementsList.find(a => a.id === 'combo_master'));
    }
    
    // 稍后在主逻辑中展示解锁提示
    return newAchievements;
  }
};
