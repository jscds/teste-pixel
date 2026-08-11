# Ecos da Última Porta — DEMO

Terror top-down com o **mapa real da mansão** como fundo.

## Controles
| Tecla | Ação |
|-------|------|
| WASD / Setas | Mover |
| E | Usar / Interagir |
| F | Lanterna |
| 1-4 | Slot do inventário |
| Espaço | Atacar |

## Puzzles
1. **Chave** — no quarto inferior esquerdo → abre o **baú** no quarto superior direito
2. **Alavanca** — no quarto oeste (meio) → libera a passagem do **beco**
3. **Nota** — no bar → dá dicas dos puzzles
4. Janelas abertas drenam sanidade
5. Fogueira restaura sanidade (mas respawna inimigos)

## Estrutura
```
EUP-demo/
├── index.html
├── css/style.css
├── js/mapdata.js, player.js, entities.js, ui.js, main.js
└── assets/mapa-mansao.jpg   ← imagem real do mapa
```

## Personagem Principal
Animações de andar, correr e atacar integradas.

![Spritesheet do Personagem](assets/character/character_spritesheet.png)