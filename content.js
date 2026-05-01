(function() {
    let wrapper = document.getElementById('madtrack-wrapper');
    if (wrapper) {
        wrapper.style.display = wrapper.style.display === 'none' ? 'flex' : 'none';
        return;
    }

    wrapper = document.createElement('div');
    wrapper.id = 'madtrack-wrapper';
    wrapper.innerHTML = `
        <iframe id="madtrack-iframe" src="${chrome.runtime.getURL('index.html')}"></iframe>
    `;

    document.body.appendChild(wrapper);
    
    let isPinned = false;
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    // Listen to outside clicks to auto-close like a popup (unless pinned)
    document.addEventListener('mousedown', (e) => {
        if (isPinned) return;
        if (wrapper.style.display === 'none') return;
        if (!e.target.closest('#madtrack-wrapper')) {
            wrapper.style.display = 'none';
        }
    });

    window.addEventListener('message', (e) => {
        if (!e.data || typeof e.data.type !== 'string') return;
        
        if (e.data.type === 'madtrack_drag_start') {
            isDragging = true;
            dragOffsetX = e.data.offsetX;
            dragOffsetY = e.data.offsetY;
            document.body.style.userSelect = 'none';
            // Disable pointer events on iframe so the parent can capture mousemove freely!
            document.getElementById('madtrack-iframe').style.pointerEvents = 'none';
        } else if (e.data.type === 'madtrack_pin') {
            isPinned = e.data.pinned;
        } else if (e.data.type === 'madtrack_close') {
            wrapper.style.display = 'none';
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        let newX = e.clientX - dragOffsetX;
        let newY = e.clientY - dragOffsetY;
        
        // Keep within viewport bounds roughly
        newX = Math.max(0, Math.min(newX, window.innerWidth - 150));
        newY = Math.max(0, Math.min(newY, window.innerHeight - 50));

        wrapper.style.left = newX + 'px';
        wrapper.style.top = newY + 'px';
        wrapper.style.right = 'auto'; // reset any right constraints
        wrapper.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            document.body.style.userSelect = '';
            document.getElementById('madtrack-iframe').style.pointerEvents = '';
        }
    });
})();
