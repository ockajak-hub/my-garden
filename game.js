'use strict';

/* ============================================================
   game.js — points, streaks and badges
   ============================================================ */

const POINTS = { plant: 15, water: 5, prune: 10, treat: 8 };

const BADGES = [
  { id: 'first_sprout', icon: '🌱', name: 'First Sprout',    desc: 'Plant your very first tree',          test: s => s.trees.length >= 1 },
  { id: 'grove',        icon: '🌳', name: 'Growing Grove',   desc: 'Have 3 trees in your garden',         test: s => s.trees.length >= 3 },
  { id: 'forest',       icon: '🌲', name: 'Forest Keeper',   desc: 'Have 10 trees in your garden',        test: s => s.trees.length >= 10 },
  { id: 'drip',         icon: '💧', name: 'First Drop',      desc: 'Water a tree for the first time',     test: s => s.game.totalWaterings >= 1 },
  { id: 'rain',         icon: '🚿', name: 'Rain Keeper',     desc: 'Water your trees 10 times',           test: s => s.game.totalWaterings >= 10 },
  { id: 'monsoon',      icon: '⛈️', name: 'Monsoon Maker',   desc: 'Water your trees 50 times',           test: s => s.game.totalWaterings >= 50 },
  { id: 'snip',         icon: '✂️', name: 'First Snip',      desc: 'Prune a tree for the first time',     test: s => s.game.totalTrims >= 1 },
  { id: 'pruner',       icon: '🪚', name: 'Master Pruner',   desc: 'Prune your trees 5 times',            test: s => s.game.totalTrims >= 5 },
  { id: 'first_aid',    icon: '🧪', name: 'First Aid',       desc: 'Apply a chemical treatment',          test: s => s.game.totalTreatments >= 1 },
  { id: 'doctor',       icon: '🧴', name: 'Plant Doctor',    desc: 'Treat your trees 10 times',           test: s => s.game.totalTreatments >= 10 },
  { id: 'roll',         icon: '🔥', name: 'On a Roll',       desc: 'Keep a 3-day care streak',            test: s => s.game.bestStreak >= 3 },
  { id: 'warrior',      icon: '🌟', name: 'Week Warrior',    desc: 'Keep a 7-day care streak',            test: s => s.game.bestStreak >= 7 },
  { id: 'diamond',      icon: '💎', name: 'Diamond Hands',   desc: 'Earn 100 points',                     test: s => s.game.points >= 100 },
  { id: 'legend',       icon: '🏆', name: 'Garden Legend',   desc: 'Earn 500 points',                     test: s => s.game.points >= 500 },
];

// Record one care action: points, counters, streak and badge check.
// Returns the list of newly unlocked badges.
function registerCare(state, type, label, icon){
  const g = state.game;
  if(type !== 'plant'){
    const today = todayStr();
    if(g.lastCareDay !== today){
      g.streak = (g.lastCareDay === addDays(today, -1)) ? g.streak + 1 : 1;
      g.lastCareDay = today;
      g.bestStreak = Math.max(g.bestStreak, g.streak);
    }
  }
  g.points += POINTS[type] || 0;
  if(type === 'water') g.totalWaterings++;
  if(type === 'prune') g.totalTrims++;
  if(type === 'treat') g.totalTreatments++;
  if(label) addLog(state, icon, label, POINTS[type] || 0);
  return unlockBadges(state);
}

function unlockBadges(state){
  const fresh = [];
  for(const b of BADGES){
    if(!state.game.badges.includes(b.id) && b.test(state)){
      state.game.badges.push(b.id);
      fresh.push(b);
    }
  }
  return fresh;
}
