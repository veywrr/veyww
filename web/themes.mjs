export const themes=[
 {id:'dark',name:'Тёмная',scheme:'dark',colors:['#080808','#0c0c0c','#141414','#202020','#292929','#343434','#ededed','#a2a2a2','#858585','#e1e1e1','#111111']},
 {id:'amoled',name:'Глубокий чёрный · AMOLED',scheme:'dark',colors:['#000000','#000000','#060606','#0b0b0b','#151515','#262626','#b8b8b8','#929292','#818181','#aeb1b5','#0a0a0a']},
 {id:'plum',name:'Сумеречная слива',scheme:'dark',colors:['#0b080f','#100b15','#19121e','#29202e','#35283c','#49364c','#e2d7e4','#bca9bc','#a28d9f','#c4a4bf','#160e1b']},
 {"id": "slate", "name": "Светлый фарфор", "scheme": "light", "colors": ["#f4f4f4", "#eeeeee", "#ffffff", "#e8e8e8", "#dedede", "#b6b8ba", "#06151e", "#454a4e", "#545a5b", "#25343d", "#ffffff"]},
 {"id": "teal", "name": "Полуночный синий", "scheme": "dark", "colors": ["#000f22", "#000b19", "#071a30", "#102b47", "#1b3554", "#3f6593", "#c0e6fd", "#80aad3", "#7395b8", "#80aad3", "#001022"]},
 {"id": "steel", "name": "Тёмный петроль", "scheme": "dark", "colors": ["#06141b", "#041017", "#11212d", "#1b303c", "#253745", "#4a5c6a", "#cdd0cf", "#9ba8ab", "#8a9ca5", "#a8bdc1", "#06141b"]},
 {"id": "mint", "name": "Оливковый лес", "scheme": "dark", "colors": ["#0b1c12", "#0a170f", "#0f2a1d", "#233e27", "#375534", "#4d6947", "#e3eed4", "#aec3b0", "#91ad94", "#aec3b0", "#0f2a1d"]},
 {"id": "sage", "name": "Светлый шалфей", "scheme": "light", "colors": ["#e3eed4", "#d1dec2", "#edf3e3", "#c7d7bb", "#b6cba9", "#8aa17c", "#193222", "#375534", "#4c6849", "#375534", "#f0f5e8"]},
 {"id": "burgundy", "name": "Бархатный бордо", "scheme": "dark", "colors": ["#2d090e", "#24090d", "#421318", "#633a2c", "#754638", "#8e5c53", "#e0d6b8", "#cdb29c", "#bb9a87", "#cdb29c", "#2d090e"]},
 {"id": "powder", "name": "Пудровый шёлк", "scheme": "light", "colors": ["#e8d2c4", "#dfc6ba", "#f7efe7", "#e4cec5", "#d7bbb4", "#9e8189", "#3e3239", "#6b5560", "#735a64", "#6b5560", "#f7efe7"]},
 {"id": "coffee", "name": "Кофейный сумрак", "scheme": "dark", "colors": ["#241713", "#2d1d19", "#3e2723", "#4e342e", "#624438", "#785b50", "#d7ccc8", "#bcaaa4", "#a1887f", "#b9a096", "#241713"]},
 {"id": "rose", "name": "Турецкая роза", "scheme": "dark", "colors": ["#26151b", "#301a22", "#43252f", "#5d313b", "#7f4250", "#9d5969", "#ead6db", "#d8b5bd", "#c7939f", "#c7939f", "#2b1820"]},
];
export const themeId=value=>themes.some(t=>t.id===value)?value:'dark';
export function applyTheme(value){const theme=themes.find(t=>t.id===themeId(value));document.documentElement.dataset.theme=theme.id;document.documentElement.style.colorScheme=theme.scheme;const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=theme.colors[0];return theme.id;}
