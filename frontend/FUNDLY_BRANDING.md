# 🎨 Fundly Branding - Charte Graphique Arcc En Ciel

## ✅ Configuration terminée (Prompt 1)

### 📋 Polices disponibles
- **Plus Jakarta Sans** : Police principale (déjà configurée)
- **Archivo** : Police alternative (ajoutée)

**Utilisation :**
```tsx
// Par défaut, Plus Jakarta Sans est utilisée
<div className="text-lg">Texte normal</div>

// Pour utiliser Archivo explicitement
<div style={{ fontFamily: 'var(--font-archivo)' }}>Texte avec Archivo</div>
```

### 🎨 Palette de couleurs personnalisée

| Couleur | Variable CSS | Classes Tailwind | Code Hex |
|---------|--------------|------------------|----------|
| Navy Dark | `--navy-dark` | `bg-navy-dark`, `text-navy-dark` | `#020617` |
| Navy Card | `--navy-card` | `bg-navy-card`, `text-navy-card` | `#0b101d` |
| Arcc Orange | `--arcc-orange` | `bg-arcc-orange`, `text-arcc-orange`, `border-arcc-orange` | `#f97316` |
| Arcc Cyan | `--arcc-cyan` | `bg-arcc-cyan`, `text-arcc-cyan`, `border-arcc-cyan` | `#22d3ee` |

**Exemples d'utilisation :**
```tsx
// Fond sombre
<div className="bg-navy-dark">...</div>

// Carte avec fond navy-card
<div className="bg-navy-card rounded-4xl p-6">...</div>

// Texte orange Arcc
<h2 className="text-arcc-orange">Titre</h2>

// Bordure cyan
<div className="border-2 border-arcc-cyan">...</div>
```

### 🔲 Arrondis massifs

**Classe :** `rounded-4xl` (2rem = 32px)

**Exemple :**
```tsx
<div className="rounded-4xl bg-navy-card p-8">
  Contenu avec coins très arrondis
</div>
```

### 💎 Effet Glass Card

**Classe :** `glass-card`

**Caractéristiques :**
- Fond semi-transparent avec `backdrop-blur-md`
- Bordure semi-transparente subtile
- Ombre douce pour la profondeur
- Effet hover amélioré

**Exemple :**
```tsx
<div className="glass-card rounded-4xl p-6">
  <h3 className="text-white">Titre</h3>
  <p className="text-slate-300">Contenu avec effet de verre dépoli</p>
</div>
```

### 🎯 Prochaines étapes

Une fois que vous avez vérifié que tout fonctionne correctement, vous pouvez passer au **Prompt 2** pour refaire la Landing Page en style "Bento Box".

---

**Note :** Toutes les classes sont maintenant disponibles dans tout le projet. Vous pouvez les utiliser immédiatement dans vos composants.
