# Layout Management

This document details how CM-Web manages its dynamic layout system using GridStack, covering initialization, configuration, state management, and advanced features.

## Layout System Overview

The layout system is built on GridStack v11.3.0 (version can be verified in `package.json`) and provides:
- Drag-and-drop widget management
- Responsive grid layouts
- Widget resizing capabilities
- Layout persistence
- Mobile/desktop layout switching
- Copy/paste layout functionality

### Dependency Verification

When working with this layout system, always verify:
1. The GridStack version in `package.json` matches the version specified in this documentation
2. Any version updates should be reflected in both the implementation and this documentation
3. Breaking changes in GridStack versions may require updates to the implementation details described below

### Critical Layout Behaviors

Our implementation addresses several critical layout requirements:

1. **Layout Preservation**
   - Exact widget positions must be maintained on refresh
   - Vertical ordering must be preserved
   - No unwanted compaction during initialization

2. **Interactive Behavior**
   - Real-time compaction during user interactions
   - Natural widget swapping
   - Smooth drag and resize operations

### Layout Types

We maintain three types of layouts:
1. **Default Layout**: The base layout configuration used as a fallback
2. **Saved Layout**: User-customized layout stored in localStorage
3. **Mobile Layout**: Single-column layout for mobile devices

## Implementation Details

### Widget Structure

Each widget in the grid consists of three layers:

1. **GridStack Item Layer** (managed by App.tsx)
   - Contains grid position and size attributes
   - Handles drag and resize interactions
   ```html
   <div class="grid-stack-item" 
     gs-id="chart"
     gs-x="0" 
     gs-y="0" 
     gs-w="6" 
     gs-h="4"
     gs-min-w="2"
     gs-min-h="2">
   ```

2. **WidgetContainer Layer** (presentational)
   - Provides consistent widget UI structure
   - Exposes drag handle via header
   - Wraps widget content
   ```html
   <WidgetContainer title="Widget Title">
     <!-- Widget content -->
   </WidgetContainer>
   ```

3. **Widget Content Layer** (functionality)
   - Contains widget-specific logic and UI
   - Manages its own internal state
   - Focuses on specific widget functionality

The integration of these layers is managed centrally in App.tsx, which:
- Defines the grid structure and widget positions
- Handles layout persistence and restoration
- Manages responsive behavior
- Coordinates widget interactions

### Layout Configuration

```typescript
interface LayoutWidget {
  id: string;      // Unique widget identifier
  x: number;       // X position (column)
  y: number;       // Y position (row)
  w: number;       // Width in columns
  h: number;       // Height in rows
  minW: number;    // Minimum width
  minH: number;    // Minimum height
}

const defaultLayout: LayoutWidget[] = [
  { id: 'chart', x: 0, y: 0, w: 6, h: 6, minW: 2, minH: 2 },
  // ... other widgets
];
```

### Initialization Strategy

The key to reliable layout handling is a multi-phase initialization that ensures proper widget positioning:

```typescript
// Phase 1: Layout Preparation and Sorting
// Sort layout by vertical position first, then horizontal to ensure consistent widget placement
const sortedLayout = [...layout].sort((a, b) => {
  const aY = a.y ?? 0;
  const bY = b.y ?? 0;
  if (aY !== bY) return aY - bY;
  return (a.x ?? 0) - (b.x ?? 0);
});

// Phase 2: Static Layout Application
const options: GridStackOptions = {
  float: false,      // Default compaction behavior
  staticGrid: true,  // Start static to ensure layout
  // ... other options
};

// Initialize grid with static behavior
const g = GridStack.init(options, gridElement);

// Apply sorted layout positions
g.batchUpdate();
try {
  // First remove existing grid attributes
  gridElement.querySelectorAll('.grid-stack-item').forEach(item => {
    const element = item as HTMLElement;
    Array.from(element.attributes)
      .filter(attr => attr.name.startsWith('gs-') && attr.name !== 'gs-id')
      .forEach(attr => element.removeAttribute(attr.name));
    
    // Temporarily disable movement
    element.setAttribute('gs-no-move', 'true');
  });

  // Apply layout in sequence
  sortedLayout.forEach(node => {
    const element = gridElement.querySelector(`[gs-id="${node.id}"]`);
    if (element) {
      // Set minimum constraints first
      element.setAttribute('gs-min-w', String(node.minW ?? 2));
      element.setAttribute('gs-min-h', String(node.minH ?? 2));
      
      // Force position and size
      element.setAttribute('gs-x', String(node.x));
      element.setAttribute('gs-y', String(node.y));
      element.setAttribute('gs-w', String(node.w));
      element.setAttribute('gs-h', String(node.h));
      
      // Update grid engine
      g.update(element, {
        x: node.x,
        y: node.y,
        w: node.w,
        h: node.h,
        autoPosition: false
      });
    }
  });
} finally {
  g.commit();
}

// Phase 3: Position Verification and Movement Re-enablement
gridElement.querySelectorAll('.grid-stack-item').forEach(item => {
  const element = item as HTMLElement;
  element.removeAttribute('gs-no-move');
});

// Verify final positions and compact if necessary
let needsCompaction = false;
sortedLayout.forEach(node => {
  if (node.id) {
    const element = gridElement.querySelector(`[gs-id="${node.id}"]`);
    if (element) {
      const currentNode = g.engine.nodes.find(n => n.el === element);
      if (currentNode && (currentNode.x !== node.x || currentNode.y !== node.y)) {
        g.update(element as HTMLElement, {
          x: node.x,
          y: node.y,
          autoPosition: false
        });
        needsCompaction = true;
      }
    }
  }
});

// Only compact if positions need adjustment
if (needsCompaction) {
  g.compact();
}
```

#### Key Configuration Points

1. **Layout Sorting**
   ```typescript
   {
     // Sort by vertical position first, then horizontal
     // This ensures consistent widget placement and prevents layout jumps
     const sortedLayout = [...layout].sort((a, b) => {
       const aY = a.y ?? 0;
       const bY = b.y ?? 0;
       if (aY !== bY) return aY - bY;
       return (a.x ?? 0) - (b.x ?? 0);
     });
   }
   ```

2. **Grid Options**
   ```typescript
   {
     float: false,     // Default compaction behavior
     staticGrid: true, // Prevent movement during initialization
     minRow: 1,       // Allow widgets at y:0
     animate: true,    // Smooth transitions
     margin: 4,       // Widget spacing
     column: 12       // Desktop column count
   }
   ```

3. **Layout Application**
   - Remove existing grid attributes
   - Apply sorted layout sequentially
   - Force exact positions through both attributes and engine updates
   - Verify final positions and compact only if necessary

### Layout Persistence

Layout persistence is implemented through localStorage with validation:

```typescript
// Layout validation ensures integrity of saved layouts
const isValidLayout = (layout: GridStackWidget[]) => {
  if (!Array.isArray(layout) || layout.length !== defaultLayout.length) {
    return false;
  }
  
  // Verify all required widgets are present with valid minimum sizes
  return defaultLayout.every(defaultWidget => {
    const savedWidget = layout.find(w => w.id === defaultWidget.id);
    return savedWidget && 
           (savedWidget.w ?? 0) >= (defaultWidget.minW ?? 2) && 
           (savedWidget.h ?? 0) >= (defaultWidget.minH ?? 2);
  });
};

// Layout loading with fallback to defaults
let layoutToApply = defaultLayout;
if (!mobile) {
  const savedLayout = localStorage.getItem('desktop-layout');
  if (savedLayout) {
    try {
      const parsedLayout = JSON.parse(savedLayout);
      if (isValidLayout(parsedLayout)) {
        layoutToApply = parsedLayout;
      }
    } catch (error) {
      console.error('Failed to parse saved layout:', error);
    }
  }
} else {
  layoutToApply = mobileLayout;
}
```

Key aspects of the persistence implementation:

1. **Storage Strategy**
   - Desktop layouts are stored in localStorage under 'desktop-layout'
   - Mobile layouts are not persisted (always use default mobile layout)
   - Invalid or corrupted layouts fall back to defaults

2. **Layout Validation**
   - Ensures all required widgets are present
   - Validates minimum size constraints
   - Maintains layout integrity across sessions

3. **Error Handling**
   - Graceful fallback to default layout on parse errors
   - Validation prevents invalid layouts from being applied
   - Console errors for debugging persistence issues

### Layout Copy/Paste
```typescript
// Copy current layout with widget IDs
function copyLayout() {
  const items = grid.getGridItems();
  const layoutConfig = items.map(item => {
    const node = item.gridstackNode;
    if (!node) return null;
    return {
      id: node.id || defaultLayout[items.indexOf(item)].id, // Fallback to default layout ID
      x: node.x,
      y: node.y,
      w: node.w,
      h: node.h
    };
  }).filter(Boolean);
  
  return JSON.stringify(layoutConfig);
}

// Paste layout with proper widget mapping
function pasteLayout(layoutStr: string) {
  const layoutData = JSON.parse(layoutStr);
  
  grid.batchUpdate();
  const items = grid.getGridItems();
  
  // Create a map of current items by their IDs
  const itemsById = new Map();
  items.forEach((item) => {
    if (item.gridstackNode?.id) {
      itemsById.set(item.gridstackNode.id, item);
    }
  });

  // Update positions in a single pass
  layoutData.forEach((config) => {
    if (config.id) {
      const item = itemsById.get(config.id);
      if (item && item.gridstackNode) {
        grid.update(item, {
          x: config.x,
          y: config.y,
          w: config.w,
          h: config.h,
          autoPosition: false
        });
      }
    }
  });
  
  grid.commit();
}
```

### Restoring Layouts
```typescript
async function restoreLayout() {
  const savedLayout = JSON.parse(localStorage.getItem('gridLayout'));
  if (!savedLayout) return;

  // Restore grid options
  grid.setOptions(savedLayout.options);
  
  // Clear existing widgets
  grid.removeAll();
  
  // Restore widgets with their content
  for (const node of savedLayout.widgets) {
    await loadWidgetContent(node);
    grid.addWidget(node);
  }
}
```

## Widget Management

### Adding Widgets
```typescript
interface WidgetConfig {
  id: string;
  type: string;
  position: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  data?: any;
}

function addWidget(config: WidgetConfig) {
  const widget = {
    id: config.id,
    x: config.position.x,
    y: config.position.y,
    w: config.position.w,
    h: config.position.h,
    content: `
      <div class="grid-stack-item-content">
        <div data-widget-id="${config.id}" data-widget-type="${config.type}"></div>
      </div>
    `
  };
  
  grid.addWidget(widget);
  renderWidgetContent(config);
}
```

### Widget Events
```typescript
grid.on('added removed change', (event, items) => {
  // Handle layout changes
  saveLayout();
});

grid.on('resizestart', (event, item) => {
  // Pause widget content updates during resize
  const widget = getWidgetById(item.id);
  widget.pauseUpdates();
});

grid.on('resizestop', (event, item) => {
  // Resume widget content updates
  const widget = getWidgetById(item.id);
  widget.resumeUpdates();
  widget.refresh();
});
```

## Advanced Features

### Custom Animations
```typescript
const animationOptions = {
  duration: 300,
  easing: 'ease-in-out'
};

grid.setAnimation(true);
grid.setAnimationOptions(animationOptions);
```

### Layout Constraints
```typescript
const constraints = {
  minWidth: 2,
  maxWidth: 12,
  minHeight: 2,
  maxHeight: 8,
  noResize: false,
  noMove: false,
  locked: false
};

function addConstrainedWidget(config: WidgetConfig) {
  const widget = {
    ...config,
    ...constraints,
    'gs-min-w': constraints.minWidth,
    'gs-max-w': constraints.maxWidth,
    'gs-min-h': constraints.minHeight,
    'gs-max-h': constraints.maxHeight
  };
  
  grid.addWidget(widget);
}
```

### Performance Optimization
```typescript
// Batch widget updates
grid.batchUpdate();
try {
  // Perform multiple grid operations
  grid.removeAll();
  savedWidgets.forEach(widget => grid.addWidget(widget));
} finally {
  grid.commit();
}

// Optimize frequent updates
const debouncedSave = debounce(() => {
  saveLayout();
}, 500);

grid.on('change', debouncedSave);
```

## Error Handling

```typescript
function handleGridErrors() {
  grid.on('error', (event, error) => {
    console.error('GridStack error:', error);
    // Implement error recovery
    if (error.type === 'layout') {
      restoreLastValidLayout();
    }
  });
}

function restoreLastValidLayout() {
  const lastValid = localStorage.getItem('lastValidLayout');
  if (lastValid) {
    grid.load(JSON.parse(lastValid));
  }
}
```

## Related Documentation
- [GridStack Integration](gridstack-integration.md)
- [Widget Container](../components/ui/widget-container.md)
- [State Management](state-management.md)

## GridStack v11 Migration Notes

### Breaking Changes

1. **Widget Content Rendering**
   ```typescript
   // BEFORE (v10) - Direct innerHTML setting (now removed)
   function addWidget(config: WidgetConfig) {
     const widget = {
       content: `<div>...</div>`  // No longer supported
     };
   }

   // AFTER (v11) - Using renderCB
   GridStack.renderCB = function(el: HTMLElement, widget: GridStackWidget) {
     // Implement proper HTML sanitization
     const sanitizedContent = DOMPurify.sanitize(widget.content);
     el.innerHTML = sanitizedContent;
   };
   ```

2. **Widget Addition**
   ```typescript
   // BEFORE (v10)
   grid.addWidget({
     content: '<div class="widget-content">...</div>'
   });

   // AFTER (v11)
   const widget: GridStackWidget = {
     id: 'widget-1',
     // content property used for data only, not HTML
     content: { type: 'chart', config: {...} }
   };
   grid.addWidget(widget);
   ```

3. **Side Panel Drag & Drop**
   ```typescript
   // BEFORE (v10)
   GridStack.setupDragIn('.sidebar-item');

   // AFTER (v11)
   GridStack.setupDragIn('.sidebar-item', {
     // Associate widget configuration with sidebar items
     dragIn: {
       'chart-item': {
         w: 3,
         h: 2,
         content: { type: 'chart' }
       }
     }
   });
   ```

### New Features to Consider

1. **Lazy Loading**
   ```typescript
   const grid = GridStack.init({
     // Enable lazy loading for better performance
     lazyLoad: true,
     // Configure lazy loading threshold
     lazyLoadThrottle: 100
   });
   ```

2. **Enhanced Widget Creation**
   ```typescript
   // Use the new utility for creating widget structure
   const el = GridStack.Utils.createWidgetDivs();
   grid.makeWidget(el);
   ```

## Layout Persistence

### Layout Application
```typescript
const applyLayout = (layout: GridStackWidget[]) => {
  grid.batchUpdate();
  try {
    // Clean slate approach - remove old attributes
    gridElement.querySelectorAll('.grid-stack-item').forEach(item => {
      const element = item as HTMLElement;
      element.removeAttribute('gs-x');
      element.removeAttribute('gs-y');
      element.removeAttribute('gs-w');
      element.removeAttribute('gs-h');
    });

    // Apply new layout
    layout.forEach((node: GridStackWidget) => {
      if (node.id) {
        const item = gridElement.querySelector(`[gs-id="${node.id}"]`);
        if (item) {
          grid.update(item as HTMLElement, {
            x: node.x,
            y: node.y,
            w: node.w,
            h: node.h
          });
        }
      }
    });

    grid.compact(); // Ensure no gaps
  } finally {
    grid.commit();
  }
};
```

### Layout Validation
```typescript
const isValidLayout = (layout: GridStackWidget[]) => {
  if (!Array.isArray(layout) || layout.length !== defaultLayout.length) {
    return false;
  }
  
  // Verify all required widgets are present
  return defaultLayout.every(defaultWidget => 
    layout.some(savedWidget => savedWidget.id === defaultWidget.id)
  );
};
```

### Save and Restore
```typescript
// Save layout
const saveLayout = () => {
  const serializedLayout = grid.save(false);
  if (isValidLayout(serializedLayout)) {
    localStorage.setItem('desktop-layout', JSON.stringify(serializedLayout));
  }
};

// Restore layout
const restoreLayout = () => {
  const savedLayout = localStorage.getItem('desktop-layout');
  if (savedLayout) {
    try {
      const layoutData = JSON.parse(savedLayout);
      if (isValidLayout(layoutData)) {
        applyLayout(layoutData);
        return true;
      }
    } catch (error) {
      console.error('Failed to restore layout:', error);
    }
  }
  applyLayout(defaultLayout);
  return false;
};
```

## Responsive Behavior

### Breakpoint Management
```typescript
const MOBILE_BREAKPOINT = 768;

const handleResize = () => {
  const mobile = window.innerWidth <= MOBILE_BREAKPOINT;
  if (mobile !== isMobile) {
    setIsMobile(mobile);
    initializeGrid(mobile);
  }
};
```

## Best Practices

1. **Layout Application**
   - Always use the clean slate approach when applying layouts
   - Apply layouts atomically using batchUpdate/commit
   - Validate layouts before saving or restoring
   - Handle errors gracefully with fallbacks

2. **Widget Management**
   - Maintain consistent widget IDs
   - Use proper widget cleanup on removal
   - Handle widget content resizing appropriately
   - Implement proper mobile/desktop transitions

3. **Performance**
   - Debounce layout save operations
   - Use efficient layout validation
   - Optimize compact operations
   - Minimize unnecessary layout updates

4. **Error Handling**
   - Validate layouts before applying
   - Provide fallback layouts
   - Log errors appropriately
   - Maintain layout integrity 

## Widget Size Management

### Minimum Size Constraints
To prevent widgets from becoming too small and maintain layout integrity, we implement size constraints:

1. **Widget Attributes**
   ```typescript
   // Set minimum size constraints on widget elements
   element.setAttribute('gs-min-w', String(Math.min(2, defaultWidget.w)));
   element.setAttribute('gs-min-h', String(Math.min(2, defaultWidget.h)));
   ```

2. **Layout Validation**
   ```typescript
   const hasValidSizes = widgets.every(widget => {
     return widget.w >= Math.min(2, defaultSize.w) && 
            widget.h >= Math.min(2, defaultSize.h);
   });
   ```

### Size Restoration
When applying layouts, we ensure widget sizes are properly maintained:

```typescript
const applyLayout = (layout: GridStackWidget[]) => {
  grid.batchUpdate();
  try {
    // First pass: Apply minimum size constraints
    layout.forEach(node => {
      const defaultWidget = defaultLayout.find(w => w.id === node.id);
      grid.update(element, {
        w: Math.max(node.w || 0, defaultWidget?.w || 2),
        h: Math.max(node.h || 0, defaultWidget?.h || 2)
      });
    });

    // Second pass: Ensure proper sizing
    setTimeout(() => {
      grid.batchUpdate();
      layout.forEach(node => {
        const defaultWidget = defaultLayout.find(w => w.id === node.id);
        if (defaultWidget) {
          grid.update(element, {
            w: Math.max(node.w || 0, defaultWidget.w),
            h: Math.max(node.h || 0, defaultWidget.h)
          });
        });
      grid.commit();
    }, 0);
  } finally {
    grid.commit();
  }
};
```

## Layout Persistence

### Layout Validation
```typescript
const isValidLayout = (layout: GridStackWidget[]) => {
  if (!Array.isArray(layout) || layout.length !== defaultLayout.length) {
    return false;
  }
  
  // Verify all required widgets are present with valid minimum sizes
  return defaultLayout.every(defaultWidget => {
    const savedWidget = layout.find(w => w.id === defaultWidget.id);
    return savedWidget && 
           (savedWidget.w ?? 0) >= (defaultWidget.minW ?? 2) && 
           (savedWidget.h ?? 0) >= (defaultWidget.minH ?? 2);
  });
};
```

### Save and Restore
```typescript
// Save layout with size validation
const saveLayout = () => {
  const serializedLayout = grid.save(false);
  if (isValidLayout(serializedLayout)) {
    localStorage.setItem('desktop-layout', JSON.stringify(serializedLayout));
  }
};

// Restore layout with size constraints
const restoreLayout = () => {
  const savedLayout = localStorage.getItem('desktop-layout');
  if (savedLayout) {
    try {
      const layoutData = JSON.parse(savedLayout);
      if (isValidLayout(layoutData)) {
        applyLayout(layoutData);
        return true;
      }
    } catch (error) {
      console.error('Failed to restore layout:', error);
    }
  }
  applyLayout(defaultLayout);
  return false;
};
```

## Best Practices

1. **Size Management**
   - Always enforce minimum widget sizes
   - Use two-pass layout application for reliable sizing
   - Validate sizes before saving layouts
   - Maintain default size references

2. **Layout Application**
   - Use batch updates for atomic changes
   - Apply size constraints before position updates
   - Handle layout validation comprehensively
   - Provide fallback to default sizes

3. **Performance**
   - Use setTimeout for reliable size updates
   - Batch related size operations
   - Validate layouts efficiently
   - Cache default widget references

4. **Error Handling**
   - Validate sizes before saving
   - Handle missing or invalid sizes
   - Provide fallback sizes
   - Log size-related errors 

### Animation Management

The layout system implements a sophisticated animation strategy that balances smooth user interactions with stable layout initialization:

1. **Initialization Phase**
   ```typescript
   // Initial grid options
   const options: GridStackOptions = {
     animate: true,  // Keep animations enabled by default
     staticGrid: true,
     // ... other options
   };

   // Temporarily disable animations during layout application
   g.setAnimation(false);

   // Apply layout
   g.batchUpdate();
   try {
     // Layout application code...
   } finally {
     g.commit();
   }

   // Re-enable animations and interactive features
   requestAnimationFrame(() => {
     gridElement.classList.remove('grid-initializing');
     setTimeout(() => {
       g.batchUpdate();
       try {
         g.setStatic(false);
         g.setAnimation(true);
         g.enableMove(true);
         g.enableResize(true);
       } finally {
         g.commit();
       }
     }, 300);
   });
   ```

2. **CSS Transitions**
   ```css
   .grid-initializing {
     opacity: 0;
     transition: none;
   }
   .grid-stack {
     opacity: 1;
     transition: opacity 300ms ease-in-out;
   }
   .grid-stack-item {
     transition: transform 300ms ease-in-out, opacity 300ms ease-in-out;
   }
   /* Ensure GridStack's own animations work properly */
   .grid-stack-item.ui-draggable-dragging,
   .grid-stack-item.ui-resizable-resizing {
     transition: none !important;
   }
   ```

### Animation Strategy

The animation system follows these key principles:

1. **Initial Load**
   - Grid starts invisible (`opacity: 0`)
   - Animations are temporarily disabled
   - Layout is applied without visual shuffling
   - Grid fades in smoothly once positioned

2. **Interactive Mode**
   - Full GridStack animations enabled
   - Smooth transitions for drag and resize
   - Real-time widget movement and compaction
   - Natural widget swapping behavior

3. **Performance Optimization**
   - CSS transitions for smooth opacity changes
   - Disabled transitions during drag/resize
   - Use of `requestAnimationFrame` for timing
   - Batch updates for layout changes

### Best Practices

1. **Animation Control**
   - Keep GridStack animations enabled by default
   - Only disable during initial layout application
   - Use `setAnimation()` method for control
   - Re-enable after layout is stable

2. **Visual Smoothness**
   - Implement fade-in transitions
   - Coordinate timing with layout application
   - Handle drag/resize states appropriately
   - Maintain consistent animation durations

3. **Performance**
   - Use CSS transitions where appropriate
   - Disable transitions during active operations
   - Batch related updates together
   - Leverage hardware acceleration

### Common Issues Solved

1. **Layout Initialization**
   - Problem: Visible widget shuffling on load
   - Solution: Hidden grid during initialization

2. **Animation Conflicts**
   - Problem: CSS transitions interfering with GridStack
   - Solution: Selective transition disabling

3. **Smooth Interactions**
   - Problem: Jerky widget movement
   - Solution: Proper animation timing and control

### Implementation Example

```typescript
function initializeGrid(mobile: boolean) {
  const gridElement = document.querySelector('.grid-stack');
  if (!gridElement) return null;

  // Start with invisible grid
  gridElement.classList.add('grid-initializing');

  const options: GridStackOptions = {
    animate: true,  // Keep animations enabled by default
    staticGrid: true,
    // ... other options
  };

  const grid = GridStack.init(options);

  // Disable animations temporarily
  grid.setAnimation(false);

  // Apply layout
  grid.batchUpdate();
  try {
    // Apply layout code...
  } finally {
    grid.commit();
  }

  // Re-enable with smooth transition
  requestAnimationFrame(() => {
    gridElement.classList.remove('grid-initializing');
    setTimeout(() => {
      grid.batchUpdate();
      try {
        grid.setStatic(false);
        grid.setAnimation(true);
        grid.enableMove(true);
        grid.enableResize(true);
      } finally {
        grid.commit();
      }
    }, 300);
  });

  return grid;
}
```

### CSS Configuration

```css
/* Base grid styles */
.grid-stack {
  opacity: 1;
  transition: opacity 300ms ease-in-out;
}

/* Initial loading state */
.grid-initializing {
  opacity: 0;
  transition: none;
}

/* Widget transitions */
.grid-stack-item {
  transition: transform 300ms ease-in-out, opacity 300ms ease-in-out;
}

/* Disable transitions during drag/resize */
.grid-stack-item.ui-draggable-dragging,
.grid-stack-item.ui-resizable-resizing {
  transition: none !important;
}
```

This animation strategy ensures:
- Smooth initial layout loading
- No visible widget shuffling
- Proper real-time animations during user interactions
- Optimal performance during drag and resize operations 