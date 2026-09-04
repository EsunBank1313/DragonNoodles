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

export const menuItems = [
  {
    "id": "m5",
    "category": "mee-sua",
    "name": "花枝羹麵線",
    "description": "脆口鮮甜的花枝羹，搭配滑順手工紅麵線，海陸雙重享受。",
    "price": 60,
    "image": "/images/taiwanese_mee_sua.jpg",
    "customizations": {
      "size": {
        "type": "radio",
        "title": "份量",
        "default": "小碗",
        "options": [
          {
            "label": "小碗",
            "priceChange": 0
          },
          {
            "label": "大碗",
            "priceChange": 15
          }
        ]
      },
      "addons": {
        "type": "checkbox",
        "title": "加料選項 (可多選)",
        "options": [
          {
            "label": "大腸",
            "priceChange": 15
          },
          {
            "label": "豬肚",
            "priceChange": 15
          },
          {
            "label": "肉羹",
            "priceChange": 15
          },
          {
            "label": "花枝羹",
            "priceChange": 15
          },
          {
            "label": "貢丸",
            "priceChange": 15
          }
        ]
      },
      "condiments": {
        "type": "selects",
        "title": "調料客製 (免加錢)",
        "options": [
          {
            "name": "香菜",
            "choices": [
              "正常",
              "多一點",
              "不要香菜"
            ],
            "default": "正常"
          },
          {
            "name": "蒜末",
            "choices": [
              "正常",
              "多一點",
              "不要蒜頭"
            ],
            "default": "正常"
          },
          {
            "name": "烏醋",
            "choices": [
              "正常",
              "多一點",
              "不要烏醋"
            ],
            "default": "正常"
          },
          {
            "name": "辣醬",
            "choices": [
              "不辣",
              "微辣",
              "中辣",
              "大辣"
            ],
            "default": "不辣"
          }
        ]
      },
      "cost_price": 35,
      "is_available": true,
      "is_published": true
    }
  },
  {
    "id": "m6",
    "category": "mee-sua",
    "name": "貢丸麵線",
    "description": "紮實飽滿的貢丸，咬下去湯汁四溢，與紅麵線完美結合。",
    "price": 60,
    "image": "/images/taiwanese_mee_sua.jpg",
    "customizations": {
      "size": {
        "type": "radio",
        "title": "份量",
        "default": "小碗",
        "options": [
          {
            "label": "小碗",
            "priceChange": 0
          },
          {
            "label": "大碗",
            "priceChange": 15
          }
        ]
      },
      "addons": {
        "type": "checkbox",
        "title": "加料選項 (可多選)",
        "options": [
          {
            "label": "大腸",
            "priceChange": 15
          },
          {
            "label": "豬肚",
            "priceChange": 15
          },
          {
            "label": "肉羹",
            "priceChange": 15
          },
          {
            "label": "花枝羹",
            "priceChange": 15
          },
          {
            "label": "貢丸",
            "priceChange": 15
          }
        ]
      },
      "condiments": {
        "type": "selects",
        "title": "調料客製 (免加錢)",
        "options": [
          {
            "name": "香菜",
            "choices": [
              "正常",
              "多一點",
              "不要香菜"
            ],
            "default": "正常"
          },
          {
            "name": "蒜末",
            "choices": [
              "正常",
              "多一點",
              "不要蒜頭"
            ],
            "default": "正常"
          },
          {
            "name": "烏醋",
            "choices": [
              "正常",
              "多一點",
              "不要烏醋"
            ],
            "default": "正常"
          },
          {
            "name": "辣醬",
            "choices": [
              "不辣",
              "微辣",
              "中辣",
              "大辣"
            ],
            "default": "不辣"
          }
        ]
      },
      "cost_price": 23,
      "is_available": true,
      "is_published": true
    }
  },
  {
    "id": "m3",
    "category": "mee-sua",
    "name": "豬肚麵線",
    "description": "獨特美味！精心處理的鮮美豬肚，口感爽脆，香氣十足。",
    "price": 60,
    "image": "/images/taiwanese_mee_sua.jpg",
    "customizations": {
      "size": {
        "type": "radio",
        "title": "份量",
        "default": "小碗",
        "options": [
          {
            "label": "小碗",
            "priceChange": 0
          },
          {
            "label": "大碗",
            "priceChange": 15
          }
        ]
      },
      "addons": {
        "type": "checkbox",
        "title": "加料選項 (可多選)",
        "options": [
          {
            "label": "大腸",
            "priceChange": 15
          },
          {
            "label": "豬肚",
            "priceChange": 15
          },
          {
            "label": "肉羹",
            "priceChange": 15
          },
          {
            "label": "花枝羹",
            "priceChange": 15
          },
          {
            "label": "貢丸",
            "priceChange": 15
          }
        ]
      },
      "condiments": {
        "type": "selects",
        "title": "調料客製 (免加錢)",
        "options": [
          {
            "name": "香菜",
            "choices": [
              "正常",
              "多一點",
              "不要香菜"
            ],
            "default": "正常"
          },
          {
            "name": "蒜末",
            "choices": [
              "正常",
              "多一點",
              "不要蒜頭"
            ],
            "default": "正常"
          },
          {
            "name": "烏醋",
            "choices": [
              "正常",
              "多一點",
              "不要烏醋"
            ],
            "default": "正常"
          },
          {
            "name": "辣醬",
            "choices": [
              "不辣",
              "微辣",
              "中辣",
              "大辣"
            ],
            "default": "不辣"
          }
        ]
      },
      "cost_price": 30,
      "is_available": true,
      "is_published": true
    }
  },
  {
    "id": "m4",
    "category": "mee-sua",
    "name": "肉羹麵線",
    "description": "手作肉羹口感紮實彈牙，保留豬肉最純粹的鮮甜與精華。",
    "price": 60,
    "image": "/images/meat_mee_sua.jpg",
    "customizations": {
      "size": {
        "type": "radio",
        "title": "份量",
        "default": "小碗",
        "options": [
          {
            "label": "小碗",
            "priceChange": 0
          },
          {
            "label": "大碗",
            "priceChange": 15
          }
        ]
      },
      "addons": {
        "type": "checkbox",
        "title": "加料選項 (可多選)",
        "options": [
          {
            "label": "大腸",
            "priceChange": 15
          },
          {
            "label": "豬肚",
            "priceChange": 15
          },
          {
            "label": "肉羹",
            "priceChange": 15
          },
          {
            "label": "花枝羹",
            "priceChange": 15
          },
          {
            "label": "貢丸",
            "priceChange": 15
          }
        ]
      },
      "condiments": {
        "type": "selects",
        "title": "調料客製 (免加錢)",
        "options": [
          {
            "name": "香菜",
            "choices": [
              "正常",
              "多一點",
              "不要香菜"
            ],
            "default": "正常"
          },
          {
            "name": "蒜末",
            "choices": [
              "正常",
              "多一點",
              "不要蒜頭"
            ],
            "default": "正常"
          },
          {
            "name": "烏醋",
            "choices": [
              "正常",
              "多一點",
              "不要烏醋"
            ],
            "default": "正常"
          },
          {
            "name": "辣醬",
            "choices": [
              "不辣",
              "微辣",
              "中辣",
              "大辣"
            ],
            "default": "不辣"
          }
        ]
      },
      "cost_price": 35,
      "is_available": true,
      "is_published": true
    }
  },
  {
    "id": "m1a",
    "category": "mee-sua",
    "name": "蚵仔麵線",
    "description": "嚴選新鮮肥美蚵仔，顆顆飽滿滑嫩，鮮甜無腥味。",
    "price": 60,
    "image": "/images/oyster_mee_sua.jpg",
    "customizations": {
      "size": {
        "type": "radio",
        "title": "份量",
        "default": "小碗",
        "options": [
          {
            "label": "小碗",
            "priceChange": 0
          },
          {
            "label": "大碗",
            "priceChange": 15
          }
        ]
      },
      "addons": {
        "type": "checkbox",
        "title": "加料選項 (可多選)",
        "options": [
          {
            "label": "大腸",
            "priceChange": 15
          },
          {
            "label": "豬肚",
            "priceChange": 15
          },
          {
            "label": "肉羹",
            "priceChange": 15
          },
          {
            "label": "花枝羹",
            "priceChange": 15
          },
          {
            "label": "貢丸",
            "priceChange": 15
          }
        ]
      },
      "condiments": {
        "type": "selects",
        "title": "調料客製 (免加錢)",
        "options": [
          {
            "name": "香菜",
            "choices": [
              "正常",
              "多一點",
              "不要香菜"
            ],
            "default": "正常"
          },
          {
            "name": "蒜末",
            "choices": [
              "正常",
              "多一點",
              "不要蒜頭"
            ],
            "default": "正常"
          },
          {
            "name": "烏醋",
            "choices": [
              "正常",
              "多一點",
              "不要烏醋"
            ],
            "default": "正常"
          },
          {
            "name": "辣醬",
            "choices": [
              "不辣",
              "微辣",
              "中辣",
              "大辣"
            ],
            "default": "不辣"
          }
        ]
      },
      "cost_price": 28,
      "is_available": true,
      "is_published": true
    }
  },
  {
    "id": "m2",
    "category": "mee-sua",
    "name": "雙腸麵線",
    "description": "人氣招牌！嚴選大腸經過慢火特製滷汁細熬，Q彈入味。",
    "price": 60,
    "image": "/images/intestine_mee_sua.jpg",
    "customizations": {
      "size": {
        "type": "radio",
        "title": "份量",
        "default": "小碗",
        "options": [
          {
            "label": "小碗",
            "priceChange": 0
          },
          {
            "label": "大碗",
            "priceChange": 15
          }
        ]
      },
      "addons": {
        "type": "checkbox",
        "title": "加料選項 (可多選)",
        "options": [
          {
            "label": "皮蛋",
            "priceChange": 20
          },
          {
            "label": "雙腸",
            "priceChange": 30
          },
          {
            "label": "豬肚",
            "priceChange": 30
          },
          {
            "label": "肉羹",
            "priceChange": 30
          },
          {
            "label": "花枝羹",
            "priceChange": 30
          },
          {
            "label": "貢丸",
            "priceChange": 30
          },
          {
            "label": "蚵仔",
            "priceChange": 30
          }
        ]
      },
      "condiments": {
        "type": "selects",
        "title": "調料客製 (免加錢)",
        "options": [
          {
            "mode": "checkbox",
            "name": "香菜",
            "choices": [
              "加",
              "不加"
            ],
            "default": "加"
          },
          {
            "mode": "checkbox",
            "name": "蒜末",
            "choices": [
              "加",
              "不加"
            ],
            "default": "加"
          },
          {
            "mode": "checkbox",
            "name": "烏醋",
            "choices": [
              "加",
              "不加"
            ],
            "default": "加"
          },
          {
            "mode": "multi",
            "name": "特製辣醬",
            "choices": [
              "不辣",
              "微辣",
              "中辣",
              "大辣"
            ],
            "default": "不辣"
          },
          {
            "mode": "checkbox",
            "name": "特製泡菜",
            "choices": [
              "加",
              "不加"
            ],
            "default": "不加"
          }
        ]
      },
      "cost_price": 30,
      "is_available": true,
      "is_published": true
    }
  },
  {
    "id": "m1",
    "category": "mee-sua",
    "name": "綜合麵線",
    "description": "豐富的配料一次滿足！包含手作肉羹、大腸、豬肚、花枝羹與貢丸。",
    "price": 70,
    "image": "/images/mixed_mee_sua.jpg",
    "customizations": {
      "size": {
        "type": "radio",
        "title": "份量",
        "default": "小碗",
        "options": [
          {
            "label": "小碗",
            "priceChange": 0
          },
          {
            "label": "大碗",
            "priceChange": 15
          }
        ]
      },
      "addons": {
        "type": "checkbox",
        "title": "加料選項 (可多選)",
        "options": [
          {
            "label": "大腸",
            "priceChange": 20
          },
          {
            "label": "豬肚",
            "priceChange": 15
          },
          {
            "label": "肉羹",
            "priceChange": 15
          },
          {
            "label": "花枝羹",
            "priceChange": 15
          },
          {
            "label": "貢丸",
            "priceChange": 15
          }
        ]
      },
      "condiments": {
        "type": "selects",
        "title": "調料客製 (免加錢)",
        "options": [
          {
            "name": "香菜",
            "choices": [
              "正常",
              "多一點",
              "不要香菜"
            ],
            "default": "正常"
          },
          {
            "name": "蒜末",
            "choices": [
              "正常",
              "多一點",
              "不要蒜頭"
            ],
            "default": "正常"
          },
          {
            "name": "烏醋",
            "choices": [
              "正常",
              "多一點",
              "不要烏醋"
            ],
            "default": "正常"
          },
          {
            "name": "辣醬",
            "choices": [
              "不辣",
              "微辣",
              "中辣",
              "大辣"
            ],
            "default": "不辣"
          }
        ]
      },
      "cost_price": 35,
      "is_available": true,
      "is_published": true
    }
  },
  {
    "id": "m7",
    "category": "mee-sua",
    "name": "清麵線",
    "description": "單純的手工紅麵線，搭配溫潤柴魚羹湯，散發經典香氣。",
    "price": 40,
    "image": "/images/plain_mee_sua.jpg",
    "customizations": {
      "size": {
        "type": "radio",
        "title": "份量",
        "default": "小碗",
        "options": [
          {
            "label": "小碗",
            "priceChange": 0
          },
          {
            "label": "大碗",
            "priceChange": 10
          }
        ]
      },
      "addons": {
        "type": "checkbox",
        "title": "加料選項 (可多選)",
        "options": [
          {
            "label": "皮蛋",
            "priceChange": 20
          },
          {
            "label": "雙腸",
            "priceChange": 30
          },
          {
            "label": "豬肚",
            "priceChange": 30
          },
          {
            "label": "肉羹",
            "priceChange": 30
          },
          {
            "label": "花枝羹",
            "priceChange": 30
          },
          {
            "label": "貢丸",
            "priceChange": 30
          },
          {
            "label": "蚵仔",
            "priceChange": 30
          }
        ]
      },
      "condiments": {
        "type": "selects",
        "title": "調料客製 (免加錢)",
        "options": [
          {
            "name": "香菜",
            "choices": [
              "正常",
              "多一點",
              "不要香菜"
            ],
            "default": "正常"
          },
          {
            "name": "蒜末",
            "choices": [
              "正常",
              "多一點",
              "不要蒜頭"
            ],
            "default": "正常"
          },
          {
            "name": "烏醋",
            "choices": [
              "正常",
              "多一點",
              "不要烏醋"
            ],
            "default": "正常"
          },
          {
            "name": "辣醬",
            "choices": [
              "不辣",
              "微辣",
              "中辣",
              "大辣"
            ],
            "default": "不辣"
          }
        ]
      },
      "cost_price": 11,
      "is_available": true,
      "is_published": true
    }
  },
  {
    "id": "s3",
    "category": "specialties",
    "name": "要你命3000",
    "description": "終極死神辣！挑戰您的痛覺與感官極限，龍城最辣至尊王牌！",
    "price": 180,
    "image": "/images/handmade_chili.jpg",
    "customizations": {
      "cost_price": 105,
      "is_available": false,
      "is_published": false
    }
  },
  {
    "id": "s4",
    "category": "specialties",
    "name": "辣泡菜",
    "description": "店內特製黃金辣泡菜，酸辣爽脆，口感開胃，佐麵線的極佳配菜。",
    "price": 210,
    "image": "/images/spicy_kimchi.jpg",
    "customizations": {
      "cost_price": 90
    }
  },
  {
    "id": "s1",
    "category": "specialties",
    "name": "要你命1000",
    "description": "挑戰開始！加入秘製鬼椒辣醬的地獄級麻辣大腸麵線，點餐請三思。",
    "price": 120,
    "image": "/images/handmade_chili.jpg",
    "customizations": {
      "cost_price": 85,
      "is_available": true,
      "is_published": true
    }
  },
  {
    "id": "s2",
    "category": "specialties",
    "name": "要你命2000",
    "description": "狂暴雙倍辣！多重麻辣風味加上雙倍滿載配料，痛快淋漓。",
    "price": 150,
    "image": "/images/handmade_chili.jpg",
    "customizations": {
      "cost_price": 85,
      "is_available": true,
      "is_published": true
    }
  },
  {
    "id": "d1",
    "category": "specialties",
    "name": "優格氣泡飲",
    "description": "",
    "price": 30,
    "image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAFAAUADASIAAhEBAxEB/8QAHAABAAIDAQEBAAAAAAAAAAAAAAUGAwQHCAIB/8QATxAAAQMDAgMDCAQJBwsFAQAAAQACAwQFEQYSByExEyJBFDI1UWFxcoEIUpGxFSMzNEJiobLBQ3OChKKj0RYXJDZTkpPCw9LhJWOUs9Pw/8QAGwEBAAIDAQEAAAAAAAAAAAAAAAMEAgUGAQf/xAA0EQACAgIABAMFBgYDAAAAAAAAAQIDBBEFEiExE0FRBiJhcbEUgaHB0fAVJDKR4fEWI1L/2gAMAwEAAhEDEQA/APZaIiAIiIAiIgCIiAIiIAiIgCITgZUJX6t0vQSGOt1FaoJB1Y+rYHD5ZygJtFUpeJWhIiQ/VFuHukz9y138VuHjOuqKM+5rz9zUBdUVNh4paCmIEWoYn59UEp/5Vuxa60vMMxXFzx7KaX/tQFlRQLdX2J3mVE7vdSyf9q2I9RW2QZb5Wf6rJ/2oCWRaEd2pJPNbUn+rv/wWby6H6lT/APGk/wAEBsotV1fABzZVfKlkP/KsMl4o4/PZWj+pTf8AagJBFDyams0Z/G1Msfx00rfvavhurNNk4N5pGfG/Z9+EBNooyDUNhneGQ3q3SOJwGtqmEn5ZUmOYygCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgMNdE+ajmhZIY3SMLWvH6JIxleUJ+GOraW8vZU2GapjjIbvgqYyDgYyBvBx49AvWNTKIad8rujG5VehIkmL3SguccnkgOI2zRFsa4C76KvEw/S2w1Dv2scQpr/I7hSCO30VqKE+Oaetx/FdtoQPrArcwEBw2n03wugduptPX9mOn4ir/i1bwi0ZTtxBQ6iix6qeb+MZXZCtSrGT0CA4tc4dLV7WMlqNZN7MYaaeWopyPeWRtJ+eVHGK2UrsU1y4hcumbjO796MrtUjCfBv2rEY3E9B9qA4xJqCuo8CjrNaOI/2khd98C1qnXutIiRS1Wpz6g+ha/wD6C7cYX56N+1fJpHyHG6NvxOQHAZeJXFZuRA28vHrdZwf+ko2p4i8aJXbYobg71h1nA/5F6ErLU7aSaqjHveoKWlMc+O0gdz6tdlAcLm1Bxprzh9DdHZ+rawP+VYPwJxhrxuFgujifF9Ixv3gL0jaYmk96aJmPXnn9gVutoApWgODh6wgPHrdGcVnyPiuFoq4mOYQGiWCPn7cOHJereHtur7Roey2u6SCSspaOOKYh24bg0DGfHHTPsWrqX8/PPwCnLNO6ot8Ujjl2CCfccIDcREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREBE6wuVDZ9MXC6XOqjpKKkhMs80hw1jG8ySuY8M+KOldbNrvwbLV0c1AwTT09fEIpDCRymaASHMyCM5y0jDgDjN14zaadrHhbqHTLKkUr7hRuiZKW7gx2QWkj1ZAz7F5+4A8Hb/Z71c9QaojZa6p9tltNNTxVLagPEjt8k5IAwC7Ja3JPednGGoD0CzWOm6Kz268TXRjqO5taaB0Mb5X1W5heOzYwF7+6C7kOQBJX7/nJ0R5Vb6Zl+hlkubQ+hEUUkgqRjJ2FrSHYHXB7vjhUvTXDrUFsboqohu9sqqvSFE+hpWupnxx1UMkLIn7zucWPzHG4EA9HAg7stkdPcKprVW6EqnXts8mmJ7lU1GKbaKqStDy/YNx7NrXSOIHe5AD2oCxDiZogw18xvjWR28htW99PK0QuLmNDXEt5OJkjw3qdwOOakqS60d3pPLKB8j4S4ty+F8RyOvdeAf2Kn6m4Wy3fT2tbU28shdqW809zZIadx8n7IUo2HDwXZ8m84FuN/s52WxWqWz2sUcr2PIe52WyzSdceMr3u/bhAZnE5K+D0X07qV8lAfDlhm81ZneCwzeagIqt8feosflvmpSt8feosflkBNWvqrlavzNqpts6q52r8zagIDUvpA+4KV0x6KZ8TvvUVqX0gfcFK6Y9FN+J33oCUREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREBqXj0ZP8KrtN5wVivHoyf4VXaXqEBO23qFIKOtx5hb5cB1ICDZ9FR1w85UvipxasvD6poqe4UFdXPrI3PjNLsLQGnByS4etVLR3Ha36y1pQ6dotPVVP5X2n4+Wob3Nsbn+aBz83HXxW1r4Hn24zyo1vw0m99Oy7lWWbRGzw3L3vQ6e7qV8lfTvFfK1RaPh6wy5woK76o0xNS11vZqmyw1WySEtdXxtdG/Bbg97IIPzC8f62i1PpfUNTY7lfqipqKcMLnwVcj43b2B4IJwTycPBdHwX2elxOUoSnyNdUmn1RrsziCxkpJbR7Irh1yFWLnfrPa7vR2+43GClqazd5O2V20P24zzPIHmMZ6+HRVf6ORqH8MhNUTSSulrpnh0ji44w1vU/CVR/pR221x/g67ST1Bukx8nii3DsuxZlznYxnO57R18fYosbhEJcTeDZJ9G1tLzRnZlSWMr4r4no219QrlavzNq8p/RR1RWVFfXWa66g3QxxM8hoqh4Lnkk7thPPDQB3Qf0s45L1ZauVI1UuK8Onw7JdE3vXmTYuQsitTRAal9IH3BS2mPRTPid95UTqX0gT7ApbTHopnxO+9a4sEoiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIDUvHoyf4V5M49651nYteVFBZ7zWUVvZDFhsTAG73Mye9jOfZles7x6Mn+FedPpZx50BbJfq3Rg+2KT/AAXR+ys6lxKELYKSl06/U1/FFL7NJxetdTkmn7lxW1fLMy0XXVN07LHaiCrl2s3Zxuw7Azg9fUVp66seudPGlGrorhTmsDjB5RVdoX7cbujjjG4dfWuq/QlrmR6g1FbSe9UU0M490bnA/wD2BSX022Ey6TfjkBWDP/BX0Ovi7p49HhsaYKD80uv9O/qc9LF58J5Dm2/n8dFfstHbrn9Ey7V01FTy19rrDBBUPjBkia6eF7g13UA7znCqv0aI+04xWp2PycVQ7+5eP4q0cL521X0aNfWzq6nnFSfcWx4/+oqE+itEH8WWPI/J0M7v3R/FY2N14PE635Slr74piC5r8aXql+DNji5xU13auIt7tdq1BJTUNLUmOKNtPEdoAGRksJPPPUqEt2suMt8wbdX6grGn9Onpe6P6TWYH2r0DxKu2ieHkQ1BcNMRVNZX1DgJqekidK6TBcS57iCOh58/cuP6t+kNfLlRzUVmslHbYZY3ROfLI6aQAjGWkbQ08/UVrOE2yy6IfZMGLSSTlLXVru+22W8qKqsfi3P5LZzPRFsqNUcQLZbqhzpn11c01DnHJc0u3SOP9EOKs/wBJiLsuLlxIAAfDA4Y/mmj+Cm/om2Q12vKu8Pja6G2UhDXfVlkO1v8AZEi0PpVM2cVHOx+UoIXfvD+C3LzOfj6x12hW/wC70/pop+Fy4LsfnI63wEhEXCCzHGDIZ3n/AI0g/gFwPj3fxe+ItXFE/dS24eSR4PIuaSXn/eJHuaF2/TF3ZpX6PNDdn43U9vdJED+lI952D5uePkvO3De0yam4hWyhnLpWzVIlqS4Z3Mb33594BHvK5zg9MY5uXxCztFyS/P8AD6mxzJt01Y8e70WHVnC/UWmdP0Go4S+qpX08c1SYmkSUchAJDh9UH9IdD1A5E37hH9IG72GOK2asZLd7cOTalv5zEPaTykHvwevM9F3u3sZI0xyMa9jgQ5pGQQfArlHEH6PX4QvNJctISxUtHVztbWUrzgU4J70kfraBz2eB6cjgR4HtBgcUg8bi8V56l6fp9H5mWRgX40lZiP5o62b3a9RUlPebNVsq6KobmORoIzg4IweYIIIwfUrPpj0U34nfeq1JaaKxUVHZrbEIqSjgZFE31ADx9ZPUnxJVl0x6KZ8TvvXAW8nO/D3y+W++jew5uVc3clERFGZBERAEREAREQBERAEREAREQBERAEREAREQBERAEREBqXj0ZP8ACvP30rGbuGFMQPMusLv7uUfxXoG8ejJ/hVLvFhtGoqFlBeqGKupWyNlEUmdu4dDyPPqeR5K/wvLjh5ld8ltRaZBk1O6qVa8zxrw51TqDSV7lrtMkCvqKZ1KCYe1Ia5zXZa3pnLB1BVxrNLcZuIs8NXdbdea1rM9m6u208bM4yWtdtAzgZ2jwXrfS9ks1ob2VqtNDQMxjFPA2PPvwOany0AHAXX5XtxF3O/Hxoqf/AKl1f5fU1FfBHycllj16LseOOHl80norTOq7FqK8/hRt8gjpzFZmOe+HaJA5xdK1jM98YwXdFFWTiRp/Rk8k+htG9lXljohcLrXPnkewkEgxsDGt6DoVJcTNAae0Tc6+r1HfW1VXU1M0lDZrdyk7JzyY3yyOHcbjqA0k+B5Ejn2nY9Ly3A1Wpqqsp6JryTS26HfM/wDVBkcGtb7SXH2eK7DGxsLNqsynz2Kem+6UnrWlFa36enxNROy6mcalqLXb1X3+R6A05bKrjZwzoanVVe6ndFdpJiaOFrSY2tLAxuc45uzk7un2cs47t0pp6ui0XpO2wRCkxJcaskyTSy47sZeeYAByQOWSOQLV6N0KKCXhhSy6Kt8VrhnpHvoIqjJDJDna6TGSeeCeZK806d4b6kuHFyn09qeknZI+V1XWzO7zZoQcveH9HBxIbkdC8ZXM8Cyq1lXzsnyVVOTjXvX4eevv6mzzapeFBRW5S0nI7j9GzSztPcPYq2pj21t3cKp+RgtixiNv2Zd/Tx4LkP0s244nUx+ta4T/AHko/gvVrWNjY2NjWsY0YDQMAAeC8r/S5bt4j0D/AF2mMfZNMqHszmzzOOSvn3kpFjiVKqwlBeWjr2n7Ba7twnsVnu9FHVUr7ZTF0b8jDuzacgjmD7Qq7oHhjbNHatrLvQ1s88U0HYwQzAF0ILgXd4ed5oA5DAz16qE4k8Tb1oSGz6dt1po3uFqp5G1NQ5zw4bdhGwbcEFh8SuS3nilrm6PeJL5NSxu/k6RoiA9zmjd+1MXgvFMmM3XNRrsbffv19BbmY1TimtyiexY6+ht8Pb19ZTUkQ/Tnlaxv2k4WnceNnDiyUhjffm10zP5KijdNu9zh3P7S8VW+lvupLj2dPBcbvWO+qHzP+fU4XY9DfR21leI457zUUlipnZyHntpvZ3Gnbz9rgfYrP/FuFYMebiGTr4LW/wA3+BD/ABPJueqKzpmnOMNr13rg2a02isghFM6bt6l7Wuy3AxsbkePXd8l2PTHopnxO+9cq0rwo01oG5+V299ZV3Axdm6pqJPA4yGtaAAMjxyfauq6Y9FM+J33rkOLSwXkfyKahrz779Tb4iv8AD/7/AOr4EoiItYWQiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiA1Lx6Mn+FV2lHeCsd39Gz/Cq5S9QgJ22+cFIHoo+2+cFIIDzZxz4P3vUXEW4akpau1220SU8UtVV1s+xrC1ux3IAnk1jTzwOfVcN/yetFdqcWq06ghdQREmoutcG00IaOpawkuPsGdzvU3BXrT6T9qkunB+5vhdIH0T46raw8nBrsOz6wGucfeAvLGlOF2uNUOZJbrHPDSuOPKqv8TEB6wXc3D4QV9a9l+Jys4a55GQoKHupdEl0XV76t+nkcnxLGUcnlrr25df36HaKfjFw+0Tpmi09ZZ7jfjQwCJkscOxriPFzn4xk56Aqk3z6QGrbtUCn07ZaOge8bI+6aqfJx5pwBzx02nwVq0j9HO205ZPqm8S1jwAXU1GOzjB8QXnvOHuDSuu6Z0ppzTMPZWKzUdDywXxszI4frPOXH5krnb83gGHJyrrd0/WXbf7+BsYU51qSlJQXou5F8JqjUNXw/tlRqhtQ27PEhn8oiEbz+Nfty0AY7u3lgKvcTeFNDrrVdHd7ndKinpaelFO6CCMb5MPc7O85DfO+qfkumP6hR1dcqGmqfJp6ljJezEm05ztLgwH/eIC5erPvryZZGN7snvt5J+hsrKq/CULXtLXc5Xxx4b1WtHWU22ppqU0JfFM+bOTE4NxjA5kFp5HA7x5qD0vwR0tbZWSXWWovEw6iQ9lF8mNOftcR7F1Zl3pKyEPbII3uIb2bzghxyAPae6enqKr9uujq28QxyTeTgxNfHE1pLZyW5JDyOYGegwcgk+pXIcV4jDH+zxm4xjv5/37laUMR2Kettls0xbrfa6dtNbaGmo4B0jgjDG/YFcKWvihiZCO/J4geHvVXoA8tcIyA/HIkZAK2rdRVlHKGd6pLhvDw3qfHPqWn27G3J7ZjxHJtx1FVR6N9X6fcYdXPqJbpSmKcwNjlD5mgbu1ZscNns7xac/qkeKs2lXB1oY5vTc771TdQVO2qc14IcMDn7lbNFP32SNw6F7j+1eS7IzxMvxnrZNoiLA2IREQBERAEREAREQBERAEREAREQBERAEREAREQBERAat39Gz/Cqjba+OWSQYLRH0J8QFbbx6Mn+FUSBraeokjPIeHuUtcVLaPGWGwXSSe5+Tvia1jmnYQeeQrKqzpenL6o1ZHdALWe0+JUvf7nTWWy113rN/k9FTvqJQwZcWsaXHA8Tgcl7bFc6jBDeltm3Ixr2lrwHNIwQei0q/keSpWudXz05vtrjuMNnkp7RBX0spa108u41DpI2NccbwyDlyOCSSDjChLa+7Xa46JrrXfJpIX2ScV1ZJSl/buY+n5EOxsL3B/MjJa1wGCQ4WIYM3Dnk9L7/AE2QPISlypbLU7UFoND5aK1giMs8I3Ahznwl/aNa08yW9m84A6NJVadqK71mv7ZBRSRw6empWSl81OW+UGRj3N2SEjv91uGAE4EhdjDc0OO1VdwvVwsVFU3N1xor4yatukRa5hbNBWCQRwkFsDd7pG89xO9pJOQBks1p1hcrtaIbPTyW6OlttukqLhXQO2U87aSWNzY2Ox2jw2cH6ocCHc+S2ceH01qTcl2ffyT7P9PP4Fd5E5NLX9i/yy18lHrTtpahrYao+SkkjYwUcDu6fVvLjy8SfatO4UF1hljuE7jLcZY5Iy6AHzWmMtA9Wezc7HreQrVQ2uOlpqiGeqqa4VTg6Y1Lg7P4trCAAAGtO3JaBjLnEDmtmXzVrPtag9RXT/CQuwvGlzN6/wBlAdp+vivb62KeOnMYeIi9glY7dNI7m3IIO14GQR4hZKG2Gnlomvm7RtIxzWjbjLjyDuvgMj5lWat8VAU9wpZapzGSDugEk9OeeXv5KKzKss7ktODVV/SWW2dVcLbjyNpVPtnVWG41T6LTM88RaJtuyDc0uHavIawEAgnvOHLIyqxbZVYh+EqKO4VcYe6rdJNGSc/inSOMX92WfYrZoyDyeyRxbi7D3cz71zzQdZVzafFJXziWeiqJaaPLA09jG7aw8uR6EEt7uQQOi6Tpj0Uz4nfes7Jbk2QwphF8yXX1JRERYEwREQBERAEREAREQBERAEREAREQBERAEREAREQBERAat39Gz/AqZcY4XNgdJubmVke5paPOcG/pEeJ8Mn1Ak4Vzu/o2f4VT64uEVOW551MAOC7/AGjfqg/twPWQMr2LcXtAtFqa1jWsaAABgBaHEGzVOoNKVdlpphAax0Uckm7BbF2je1wcHvbN2OXXCkbb1CkFlXZKuanHuupjKKkmmU6g0tPBqyG61szbhNHaBRfhCWOMT7hI52QGgAZDueAAcdFUrrwrhoaCzUFirZmGCthlr6+pqHOqZIYg7axpAxgEgho2tBAdgkEO66o+v85Wa8++D3F/p++pE8et90REVNTwSzyQU8UT539pK5jA0yOwBudjqcADJ9QX2ei+ndSvlVG23tk+tHw7wWGboszlzuSW50fEq61styuMNuAp2NpKgtMNQHNLXdg0uJywhryWgFxc5uHELwFouALmPaHbSQQD6vauZVcckdyljkYXPY8uBfI1u7JJHgcDly6nIIXSJKqCpjD4n5B8HAtcPDmDgg+9VG+wOo7oLpFIyJr8Rvc5uQw/WySGt5DG48s49agyKpWJcr0S1zUW9lh0FcZKymMNQ5pmiIHIEZbgYPNWW79vXQx01LUNzC5rOzDi1wkkcGiXOcYjaXuAIO5wbjBbzpWlY47ZJcbg0bHzdlTiIEua6WMO3uZnGRue5u0AfkyR1wLroi2GpiZdat28AkwMIyN3jJnx9QwGg83YyeVmiqSqc7GRya37phuVqt1tuMrqCip6Z0rWCQxxhpcGjug+vGT9p9asel/RTfid96idS/n5HsCltL+im/E7714233PEtEoiIvAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQGrd/Rs/wrkPEPU1ZZ7tZ6OkhoqhrpPKKmnnY8Pljja6T8U9uWse3sicPad3IAtwXDr139Gz/CuW8RrfU/ghuobPbW1t8tWZqQbyORa5r8sHKTuPeA08+87aQSpKq3bNQXn06mM5KMXJ+R0q1Oa9rXseHtcMgjoQtyrmEFPJKf0Wk4XBfo88T4XWt1l1RWCKSJxNJUOaAwxnpHyGG7fDwxy5YGesS600xNuhbcjJu7pdHE8gfPGPsVziHCMzFsnTyttdml0+ZBRl1WxU9kSL1cHziYPdJKXgNYxxDTk9Bzwf8AwrRI90lOx7xteR3m+oqm291vjucNbRXB9eyGQtZTU7GNlne4uAaQ8DIaGSHII/JnmcEGZ0tQTUdqdLVUxp6qole6RpBbyaS1h2734yxrT5x68+eVy/CsLIxnJ3t7fkzZ5F1dmvDXQ3HdSvk9FhrqsUs1Mw09RKKifsi6Jm4Rd1ztz/U3u7c8+bm+GSIm3193NTSR11KHOnijjljp48tppWte6V73l2Nh/Fta0Zdk+I3Fu4Kjkk9Ey9a9ZFHPTvhmjZJE9pa5j2gtcD4EHkQth6wzeah6U272SVoa2j7Hs4dwhjdI9pY0jm3cd3LmcDAxhoHIKt181XTRTUFXVPa+SERnvtwA7cC4Ennnp0zy6DK6DW+PvXPNSVJF5l3ObEWtAY7tSMtHPngt55LuW8cscir+LJ2vka6IxfQlbS9lxuApsCI1c5ftZKXtZ3QXAZIxkMc7k0Dcc9eZ7LZ2NZb42MaGtaMADoAPBca0BM2a9sY6RrntY54APqGD+m/6y7NavzNq8zkoSUF20IkBqX0gfkpbS/opvxO+9ROpfSB9wUtpj0U34nfeqJkSiIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgNW7+jZ/hVdpeoViu/o2f4VXKXqEBVL5wls13ust0tlU+01czt0rWxCSF7upds5EOPscB44ySVXq+xQWrUMFro71U1ktL3q9wYxsIJb3Yg3BduwQ4ku5ANwO8cdUvdeLbp2uq+3dBIIXNheyISOEhGGYYSNx3Ecsj3jquO0AqLZMYKsSdsSZHPkOXSEnJeT4knJJ9eV1XCcjKyYNTsbjHol/n4Gpy401zSiurJKa2eR1dLXRXKZjo5i5schDmgmTtQGDkA7dv73M7ZHtyMjHWaWtZcLbT1rQAJWAkA9D0I+RyFzChsdVq2C4TUxB/BkbXUgy3D6vIeAT1bhgDT6xOfUtTSPEakswfb7yyaKjL3FrzGd9O/OHMe3r1B6cwc9c8sM3DllRaq6zh3XzMqLlU/e6JnRrjRyT1TKhtXOxscb2upwWiKbcMDflpPLwII6+IULTCG42WnqjbJrlRVnYuEAEe1zHbXCUiQgEDkcdeXQnko/UesLFddKzC1XMyRVxbTeVMp5jHGx8gjkcXhuGOa0vcA4joPWrnGxkUbYo2NYxoDWtaMBoHQBc1JSg3FrTLsqYWTjZvsfj+q1qyWKCF0s0rImDkXPcABkgDmfaVVtJ69pbxX3m03K3VVputmq/JamneDK1+RujfG5oy4PZhwBAd1GDglft8rKO9RSUNbtloXAh9DTt7eec/o79uexAIyDkHOw7mbS0o8vMubsTPeuhivV6jdvjpnYA6vII3ewKh3WfvFwc7k7G4A+OfHl78LbvNHdtPxNfcYpqq2E7vKRh08LTjuT4yAR/tG5acEnbyzVauv7djZWSGSN7toeyTe7I57mtB54b8vb6ujxcOHSVb2vX9/Q11tr7S7nRODjXyVV3qZ3SOf2kUbWvPJjdm/ujwzv8AngLtVq/M2riXAd7ZrVdZmxtZm47cNdkYEEJ9Z58zn2/Yu3Wr8zatVxVNZUk/LX0LWK91Jlf1L6QPyUtpj0U34nfeonUvpA/JS2mPRTPid9615YJRERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQGrd/Rk/wqu0vUKfvhItU+Pqj7wuRan1rdbRxLs+mKGktRpKm11FdVVFwqzTtaWyRxsDXgEZy85Bac7m4IwcgXDWLmH8ERyhux9YQzJ59p2UhH9kP/AGLDV2ejrqLZVwMmaw5aDkFueRIIII8Pfy9SpE991DfbM2mrLzagSWTRy0VIdrXscHNILpHZGR4YyM+tW/S99ju1rjn2tjl3OhniDs9nI07XDPiAeYPqxyC6COPdRRF+nocxZl035DcGWrRNkobFZBT0BkeyaR073yEF7nOPiQBnAAaPY0Ko8UOGVn1XNJWwzyWu5PGHVETA5kuBgdozluIHLILT0BJAAV70/HNHbI2zsLXZJweoGUr/ADlq4Zl9GQ7q5vm9TfRqhbSozXTRxWj4YVstTYbVcrpM+02OBz3tEbezrXzPcXMZgh0ezs2OO7eHCUgbSMjqxyefivp3Ur5Kr22ytm5y7t7ZPCKhFRXZFXr9F2uq10zVz561tQbf5BU0rZf9Gqo2v3xmRmO8WFz8fEc5U8WMjiEcbWtY0Ya0DAHuWdxGcZWGbzSoz3aIa7TMp6aaolz2cTXPdgZOAMnkuZN0TZLneWtrKARTR05krjTOdCDPK4FoDoy0EtDXg5BOHsJ65Nj1PrHTb5PJYr5apHRVTYnsNUwB84cNkAOfP3lhIGcAEEd4KRttK2kaWb+0le4vmkxgyPPVx/YAPAAAcgFLVfbS91ya+RjKEZr3ls2uH+m7bpmino7Z24hmnM7hLKXncWtbyJ8MMC6NRyllEwN84/sVStnVWCkl7hB8Dheuc75uc3ts9jFRWkVnVpca9xc4n3lWbQ2Tp+EuJJ3v6n9YqrapfmucrToXnp2E/rv/AHis7VqJ75k6iIqx6EREAREQBERAEREAREQBERAEREAREQBERAEREAREQGpeRm2T5+quWWvRr3cYazX1fNG8stUVrt0LST2bN5klkdkcnFxAGPBpz15dUu/o2f4Vx7jDq+8aKtdlulDHRC3VF1hornVVMEkraKGXIE5DHtw1pAySfEDllAY9QXCzU9yqLJYYA6oDz5fcn4eYic5iizyEnrcBhvTm7O228PbK2SnhnELYKCDlDGByeR/D2+J+ao+jtCVr7vS07YJ4rO/MsU0mBI6EY88Dk1zieQ64IJwdzR3WnhjghZDE1rI2ANa0DkAFvs7KqrpjXTLba22/3/o5jAw7b8qdl0OWMXpL1+PxMmOSj7h5ykSo6v8AOWhOnI1/InKiaysfI4sicWsHLI6lbl1lLIC0HBecfLxUZGzllZRRqs6+XN4UXr1PgMzzxz9aVMbZ6OakqWdtTzRmOWNxOHNIwR9i2Ws5L8laAFk9ENNcodUyj0/DHh1b3xT0GjLJC+KVs0bxSML2Pb0IcRnlnOOmcepTjfyq3nnDnNz15rQH5b5qM3FcuaOybtfVS7g6Hvfov5hRFs6hWykpoqq3iOUZGeRHUKSqfJLbMmc91LLmudzVz0Ad2moD+u/94qt6ksQ/CLsVbg34Of3q16Np2U1iihYXENc7mep5lT32QlHUTxImURFUMgiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiA0b9KyG0VMkhw1rMkrkfE6lj1jw9vumIoedfRPjic92MSAboyfYHhp+S6pq7/Vut/m1zajB3BZximaDi+fdj2RhW9bLBoWrrrdpq022oELpqWihgldzO5zGNaTnPiQrdS3OOQ7ZR2Z9fUKo2vzgpePwWTijX0cUyVLcpbLOCCMhR9f5y+LZUFpELzkHzfYvuv8AOUbWjqMe9XQUkV28c5Yx7D96wRtW5dY9zGv+qfvWtF0WS7Guur/mG2feMBYp8AZJWU9FDXOp7V5Yw9wftWVcHNkkpKKMFVWRCUNZl59nRaBrHCb8kMZ9a+msLpSfBvNa7m/jPmpZVxT0SVWT5dlkstZFI8NOWOPQHxV6tP5oFzGiHMK/aVqzJSdhIcuaMg+sLCdWltE1d+5csiO1F6QcpnTHopnxO+9Q2oT/AOoOUvpZzXWpu0g4e4cvWCVAWtkqiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiHogIrVv+rlb/N/4LnFIO8F0jVf+r1Z/N/4LndI3vBSw7HL8cju6Py/MnLWOYUtGFGWscwpZgWTZrqodTLFkEEcltVD97Gv9YWCML7P5I+wlRyOg4a2pOPqacjQ4OaRkHktB0TonYPm+BW7USsiY6SR21o8Vq0twpaqQxMLg71OGM+5IxlraRs7alZp+ZqXCQx0ziDzdyChuzfI7awf+FYbjFGWNy0HvfwWk9rWtwGge5WKp8sehTnQ3PqyKljEbNo+Z9ajf5X5qWq1F/yg96xb2yXWlo36IdFZ7LIYTHJ4B3P3Ks0Z5qwUZ/0VWILa0VLXrTQ1lUeTvnlB7wGG+0nkFKcPOel6ckkkvf1+Iqt8QXu7aGL1kuPyH/lWXh8MaYpx+s/94qhrUTKNzs4g4+Sj+hYERFibYIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgIvVIzp+rH/trn9I3vBdC1P6Bq/5tUOkb3gpIHP8WhzWx+RNWxveClYwo62N7wUjI4RRl32L3uUIxUVtmdmAMk4Q4MRIPLcVGSPc85c4lbDg6CFoB5gc15JdC7w/KUrHpdEaN6Y58bR+iCc+9RNNARVRFg57gVYSWzRnIyD1C+I4YoySxoB9azhdyR0dAtPqYLiD2LXDwKj5HAhS07BIwsPiMKCm3Rucxw5he1dVor3+69mpWO6qJcfxqkKt/VRTn/jFJykLkStG4ZCstlZ2zoo+uXjPu8VU6V/eV90dSkUxqpBgu5M93iVLKXJBsgjHxZpIrnEAZuEZ8O9/BWfQQxpmn+J/7xVf1zHvn348x37D/wDwVh0Ly05Tj9Z/7xVBv3T2qtxz5P1X6E6iIsTbBERAEREAREQBERAEREAREQBERAEREAREQBERAEREBHal52Sq+BUalb3gr3qBpdZqloGSWdFS6aMh4BGD7VlE1OfBymmTFsb3gti48nMHvK+bYOYW7UUck4DvNDeufUs00ULcec63GC6mjQw9rLucO439pX7cZAHFbwa2KMMYMAKGukh3Fet7MIRWNDl8z7oXbmv9WVsLDQxOipwHec7mfYsx6KJ9zocZPwo7Ph60rhStnZnO14HJy3XeCxS9CibT2iWUVJaZUrhTVMROYy4etvNRQinfLhsMhOfFuFcavxUaPynzU6yH6FZ4i9T9slsJeJKkggdGDx966FaOVKAFUrf1Ct1p/NVFOyU+5PXVGtaiVrUTGy1UrHDIdyKmdHxOhsUMbuoc/wDeKiL3+fO96ntN+h4ve794rA9dacufzJFERDMIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgNW7+jZ/hVcpgCRkAqx3YE22fAz3FXKXqEBN27aDnAW+SFyni9Df5WWY2SWvZtfPuFG54eX9kSOTSM90SY6nOMdVQbnUX5lptQnul7ikNCwvjdK9kjWmWZwcC7GcNAHiXDHsztcXhX2mEZqaW/LzRTtylVJrl7HouemjkPnFnuWhNQwRydpze4dC7oFx9kV7q9T2+sgutS2OLsHzwvY55ka2VjZM8yc428w0gZ6jLl+01demNnD6upZHFSzhjqjyh5kmY4gx8pmkSZA2t278EHqCB6+GNLpNEHNU58zh1OruPMr5XH9E1ldJJUx3y/STUct1ZLIYpZKcNY6nlLiXB+WtMgZ3QQMj2hdK0u6I0M3k08k9KKh4gkfM6UlvL9JxJIznxVbKwnjtpvei5VerPIk3eCwyrM/wAFQuJ7amaut1My4Ot8DopZDP5W6Jpe0sw0jc0E5cHAknmzpjOYcenxrFBvRnZPkjvRZ6vqeajv5X5rjmpK2+svNva+6VzC6mgcWtqnuawlodh7sjJ5jJOP4q83SG41NdVmGpuMBEONzIpHRv8AxrCAxrHjGGtcCQ4Od2rjkBoCvZHC/BUXzp8xDXk8+1rsX+39QrbafzYLkNF/lGyB76WKshrCHOnbI7tY8iOZ0TY9xIxkRNcRjOeuckdH0cy4MfVGvfLIB3Y3vAG4B8gBwMDJbt6AKnZj+Gt8yZLGzmetGneuda73qf036Hh97v3iq/efzx3vVg056Hh/pfvFViUkUREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAfkjQ9jmuGQRghc0r9QOsd/mtd1p9u07opWHk+M+acevlg+0FdMVR4naWOorP2lG0C5UoLoDnG8eLD78cvUQPagNmy6gtdQ0FtRgH1j/BTcdZQyDuzxn3nH3rzVQ3Wooqp1PMXwyxu2vY8FrmkdQQrbatSSEAGTPzQHbRJTu5tkjPucFpVrm7u6R8lz2nvReM9oftWSS8vA5SFAW5xOeq+DzOSqNVXypaO7MQomo1NWsJxUuQHTHLDI4AHvALlNTqyvwcVDyois1TcHZ/0iT5FAdcqqiED8vGP6YUW6spI35fVQNGfGQLkFRd7lUO/LS4PtWq6Gtn/KTP+ZTYO2N1NYKQ5qLtTNx1w7d92Vsjiro6hi2MrKird6oICf3sBcJbZmOO6aQ9fErP2duoWbnvjz7SgOo1evI7rXsitNsnklqJBFA2ZwaXOccDIGeXrOei67bqfyWihgJBLGgOIGAT4n7VzPg1o2enkbqa8QOimcwihp3twYmkc5HDwcRyA8BnPXl1QIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgIe/aX0/fRm62qmqX9O0Ldsg9zxhw+1VSp4R6cL3SUNbdqEnzWRzh7R/vtJ/auhogOWnhZdYnnyXVwbH4Nlt+4/aJB9ywVHDrVrCfJ75a5x4GSF8f3bl1lEBxafh7r8uw2bTz2+s1Erf+kVpy8M9fvPnad/+XL/APku6ogOBScKtfO/T04P63N/+S/P8zus3EF1bYW56/jZTj+wu/IgOGU3BjUbj+P1FboBn+TpXycvm5q2ouCVzdIPKNbns/FsNsDHfaZD9y7SiA5TT8DdPEtdXX3UNWR5zfKI2Md8msz+1WnT3DfRdiqo6ugscJqY+bZp3vmc0+sbycH2jCtqIAAiIgCIiAIiIAiIgCIiAIiIAiIgP//Z",
    "customizations": {
      "cost_price": 15,
      "is_available": true,
      "is_published": true
    }
  },
  {
    "id": "m8",
    "category": "specialties",
    "name": "肉包",
    "description": "",
    "price": 25,
    "image": "/images/big_meat_bun.png",
    "customizations": {
      "cost_price": 15,
      "is_available": true,
      "is_published": true
    }
  },
  {
    "id": "d2",
    "category": "specialties",
    "name": "A&W 麥根沙士",
    "description": "",
    "price": 35,
    "image": "data:image/jpeg;base64,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",
    "customizations": {
      "is_available": true,
      "is_published": true
    }
  },
  {
    "id": "m8_bulk",
    "category": "specialties",
    "name": "肉包(量販包)",
    "description": "",
    "price": 200,
    "image": "data:image/jpeg;base64,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",
    "customizations": {
      "cost_price": 150,
      "is_available": true,
      "is_published": true
    }
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

export const luzhouFallbackMenuItems = [
  {
    id: 107,
    category: "specialties",
    name: "辣泡菜",
    description: "獨家手作黃金開胃辣泡菜，酸香微辣超解膩。",
    price: 210,
    image: "/images/taiwanese_mee_sua.jpg",
    customizations: { is_available: true, is_published: true }
  },
  {
    id: 108,
    category: "specialties",
    name: "肉包",
    description: "熱騰騰現蒸手工招牌大肉包，肉汁豐潤。",
    price: 25,
    image: "/images/taiwanese_mee_sua.jpg",
    customizations: { is_available: true, is_published: true }
  },
  {
    id: 109,
    category: "specialties",
    name: "肉包(量販包)",
    description: "冷凍外帶家庭量販包，在家也能享受美味。",
    price: 200,
    image: "/images/taiwanese_mee_sua.jpg",
    customizations: { is_available: true, is_published: true }
  },
  {
    id: 110,
    category: "specialties",
    name: "要你命1000",
    description: "特製地獄特調辣醬 (入門級挑戰)。",
    price: 120,
    image: "/images/taiwanese_mee_sua.jpg",
    customizations: { is_available: true, is_published: true }
  },
  {
    id: 111,
    category: "specialties",
    name: "要你命2000",
    description: "特製地獄特調辣醬 (進階狂辣版)。",
    price: 150,
    image: "/images/taiwanese_mee_sua.jpg",
    customizations: { is_available: true, is_published: true }
  },
  {
    id: 112,
    category: "specialties",
    name: "要你命3000",
    description: "極限地獄死神特調辣醬 (魔王終極挑戰)。",
    price: 180,
    image: "/images/taiwanese_mee_sua.jpg",
    customizations: { is_available: true, is_published: true }
  }
];


