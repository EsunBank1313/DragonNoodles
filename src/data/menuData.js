export const menuCategories = [
  { id: 'mee-sua', name: '招牌麵線', icon: '🍜' },
  { id: 'specialties', name: '特色產品', icon: '🔥' }
];

export const defaultUpgradeCombos = [
  {
    id: 'upgrade_a',
    name: 'A. 開胃小資套餐',
    tag: '🔥 超值省 $20',
    price: 40,
    description: '特製黃金辣泡菜 1份 ＋ 沁涼冷飲 1杯',
    slots: [
      {
        id: 'side',
        title: '🥬 開胃小菜 (選 1)',
        options: [
          { name: '特製黃金辣泡菜', priceChange: 0, default: true },
          { name: '熱騰騰招牌大肉包 (1顆)', priceChange: 0 },
          { name: '現炸脆皮臭豆腐', priceChange: 15 }
        ]
      },
      {
        id: 'drink',
        title: '🥤 沁涼冷飲 (選 1)',
        hasDrinkOptions: true,
        options: [
          { name: '古早味冰紅茶 (500cc)', priceChange: 0, default: true },
          { name: '鮮檸冬瓜露', priceChange: 5 },
          { name: '無糖高山冷泡茶', priceChange: 5 }
        ]
      }
    ]
  },
  {
    id: 'upgrade_b',
    name: 'B. 人氣飽足套餐',
    tag: '🥟 飽足首選',
    price: 55,
    description: '招牌大肉包 2顆 ＋ 沁涼冷飲 1杯 (現省 $20)',
    slots: [
      {
        id: 'side',
        title: '🥟 飽足點心 (選 1)',
        options: [
          { name: '招牌大肉包 (2顆)', priceChange: 0, default: true },
          { name: '極品肉羹湯 (1碗)', priceChange: 0 },
          { name: '泡菜1份 + 肉包1顆', priceChange: 10 }
        ]
      },
      {
        id: 'drink',
        title: '🥤 沁涼冷飲 (選 1)',
        hasDrinkOptions: true,
        options: [
          { name: '古早味冰紅茶', priceChange: 0, default: true },
          { name: '鮮檸冬瓜露', priceChange: 5 },
          { name: '無糖高山冷泡茶', priceChange: 5 }
        ]
      }
    ]
  },
  {
    id: 'upgrade_c',
    name: 'C. 豪華大滿貫全席',
    tag: '⭐ 豪華全套',
    price: 65,
    description: '極品肉羹湯 ＋ 特製辣泡菜 ＋ 沁涼冷飲 (現省 $25)',
    slots: [
      {
        id: 'soup',
        title: '🍲 精緻湯品 (選 1)',
        options: [
          { name: '極品肉羹湯', priceChange: 0, default: true },
          { name: '雙寶肉羹貢丸湯', priceChange: 10 }
        ]
      },
      {
        id: 'side',
        title: '🥬 開胃小菜 (選 1)',
        options: [
          { name: '特製黃金辣泡菜', priceChange: 0, default: true },
          { name: '招牌大肉包 (1顆)', priceChange: 0 }
        ]
      },
      {
        id: 'drink',
        title: '🥤 沁涼冷飲 (選 1)',
        hasDrinkOptions: true,
        options: [
          { name: '古早味冰紅茶', priceChange: 0, default: true },
          { name: '鮮檸冬瓜露', priceChange: 5 },
          { name: '無糖高山冷泡茶', priceChange: 5 }
        ]
      }
    ]
  }
];

const standardMeeSuaCustomizations = {
  can_upgrade_combo: true,
  size: {
    title: '份量',
    type: 'radio',
    options: [
      { label: '小碗', priceChange: 0 },
      { label: '大碗', priceChange: 15 }
    ],
    default: '小碗'
  },
  addons: {
    title: '加料選項 (可多選)',
    type: 'checkbox',
    options: [
      { label: '大腸', priceChange: 15 },
      { label: '豬肚', priceChange: 15 },
      { label: '肉羹', priceChange: 15 },
      { label: '花枝羹', priceChange: 15 },
      { label: '貢丸', priceChange: 15 }
    ]
  },
  condiments: {
    title: '調料客製 (免加錢)',
    type: 'selects',
    options: [
      { name: '香菜', choices: ['正常', '多一點', '不要香菜'], default: '正常' },
      { name: '蒜末', choices: ['正常', '多一點', '不要蒜頭'], default: '正常' },
      { name: '烏醋', choices: ['正常', '多一點', '不要烏醋'], default: '正常' },
      { name: '辣醬', choices: ['不辣', '微辣', '中辣', '大辣'], default: '不辣' }
    ]
  }
};

const plainMeeSuaCustomizations = {
  can_upgrade_combo: true,
  size: {
    title: '份量',
    type: 'radio',
    options: [
      { label: '小碗', priceChange: 0 },
      { label: '大碗', priceChange: 10 }
    ],
    default: '小碗'
  },
  addons: standardMeeSuaCustomizations.addons,
  condiments: standardMeeSuaCustomizations.condiments
};

export const menuItems = [
  // 🍜 招牌麵線系列 (均支援升級超值套餐)
  {
    id: 'm1',
    category: 'mee-sua',
    name: '綜合麵線',
    description: '豐富的配料一次滿足！包含手作肉羹、大腸、豬肚、花枝羹與貢丸。',
    price: 65,
    image: '/images/mixed_mee_sua.jpg',
    customizations: standardMeeSuaCustomizations
  },
  {
    id: 'm1a',
    category: 'mee-sua',
    name: '蚵仔麵線',
    description: '嚴選新鮮肥美蚵仔，顆顆飽滿滑嫩，鮮甜無腥味。',
    price: 55,
    image: '/images/oyster_mee_sua.jpg',
    customizations: standardMeeSuaCustomizations
  },
  {
    id: 'm2',
    category: 'mee-sua',
    name: '雙腸麵線',
    description: '人氣招牌！嚴選大腸經過慢火特製滷汁細熬，Q彈入味。',
    price: 55,
    image: '/images/intestine_mee_sua.jpg',
    customizations: standardMeeSuaCustomizations
  },
  {
    id: 'm3',
    category: 'mee-sua',
    name: '豬肚麵線',
    description: '獨特美味！精心處理的鮮美豬肚，口感爽脆，香氣十足。',
    price: 55,
    image: '/images/taiwanese_mee_sua.jpg',
    customizations: standardMeeSuaCustomizations
  },
  {
    id: 'm4',
    category: 'mee-sua',
    name: '肉羹麵線',
    description: '手作肉羹口感紮實彈牙，保留豬肉最純粹的鮮甜與精華。',
    price: 55,
    image: '/images/meat_mee_sua.jpg',
    customizations: standardMeeSuaCustomizations
  },
  {
    id: 'm5',
    category: 'mee-sua',
    name: '花枝羹麵線',
    description: '脆口鮮甜的花枝羹，搭配滑順手工紅麵線，海陸雙重享受。',
    price: 55,
    image: '/images/taiwanese_mee_sua.jpg',
    customizations: standardMeeSuaCustomizations
  },
  {
    id: 'm6',
    category: 'mee-sua',
    name: '貢丸麵線',
    description: '紮實飽滿的貢丸，咬下去湯汁四溢，與紅麵線完美結合。',
    price: 55,
    image: '/images/taiwanese_mee_sua.jpg',
    customizations: standardMeeSuaCustomizations
  },
  {
    id: 'm7',
    category: 'mee-sua',
    name: '清麵線',
    description: '單純的手工紅麵線，搭配溫潤柴魚羹湯，散發經典香氣。',
    price: 35,
    image: '/images/plain_mee_sua.jpg',
    customizations: plainMeeSuaCustomizations
  },

  // 🔥 特色產品
  {
    id: 'm8',
    category: 'specialties',
    name: '肉包',
    description: '老麵發酵外皮軟Q，肉餡飽滿多汁，咬開爆汁的好吃大肉包。',
    price: 25,
    image: '/images/big_meat_bun.png',
    customizations: {
      temperature: {
        title: '溫冷選擇',
        type: 'radio',
        options: [
          { label: '熱肉包', priceChange: 0 },
          { label: '冷凍肉包', priceChange: 0 }
        ],
        default: '熱肉包'
      }
    }
  },
  {
    id: 's1',
    category: 'specialties',
    name: '要你命1000',
    description: '挑戰開始！加入秘製鬼椒辣醬的地獄級麻辣大腸麵線，點餐請三思。',
    price: 120,
    image: '/images/handmade_chili.jpg',
    customizations: standardMeeSuaCustomizations
  },
  {
    id: 's2',
    category: 'specialties',
    name: '要你命2000',
    description: '狂暴雙倍辣！多重麻辣風味加上雙倍滿載配料，痛快淋漓。',
    price: 150,
    image: '/images/handmade_chili.jpg',
    customizations: standardMeeSuaCustomizations
  },
  {
    id: 's3',
    category: 'specialties',
    name: '要你命3000',
    description: '終極死神辣！挑戰您的痛覺與感官極限，龍城最辣至尊王牌！',
    price: 180,
    image: '/images/handmade_chili.jpg',
    customizations: standardMeeSuaCustomizations
  },
  {
    id: 's4',
    category: 'specialties',
    name: '辣泡菜',
    description: '店內特製黃金辣泡菜，酸辣爽脆，口感開胃，佐麵線的極佳配菜。',
    price: 210,
    image: '/images/spicy_kimchi.jpg',
    customizations: null
  }
];

// Helper to check if an upgrade combo package can be applied to a specific menu item
export const isComboApplicableToItem = (combo, item) => {
  if (!combo || !item) return false;
  if (item.customizations?.can_upgrade_combo === false) return false;

  const scope = combo.applicableScope || 'all';

  if (scope === 'all') {
    return item.customizations?.can_upgrade_combo === true || 
           item.category === 'mee-sua' || 
           (typeof item.name === 'string' && item.name.includes('麵線'));
  }

  if (scope === 'category') {
    const cats = combo.applicableCategories || [];
    if (cats.length === 0) return true;
    return cats.includes(item.category);
  }

  if (scope === 'items') {
    const names = combo.applicableItemNames || [];
    const ids = combo.applicableItemIds || [];
    if (names.length === 0 && ids.length === 0) return true;
    return names.includes(item.name) || (item.id && ids.includes(item.id));
  }

  return true;
};
