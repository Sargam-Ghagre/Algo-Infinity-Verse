// ===== STATE MANAGEMENT =====
const COMMUNITY_STORAGE_KEY = 'algoInfinityVerse_communityPosts';

// Sample initial data if storage is empty
const initialPosts = [
    {
        id: 1,
        title: "How to approach dynamic programming?",
        content: "I always struggle with finding the state and base cases for DP problems. What's a good mental model for this?",
        tags: ["dp", "help", "strategy"],
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        votes: 12,
        userVote: 0,
        comments: [
            { text: "Try to solve it recursively first, then memoize it. If you can write the recursive relation, you have your state!", timestamp: new Date(Date.now() - 80000000).toISOString() }
        ]
    },
    {
        id: 2,
        title: "Great resource for Graph Algorithms",
        content: "Just found this amazing visualization tool for Dijkstra and A*. It really helped me understand how the priority queue works under the hood.",
        tags: ["graphs", "resources"],
        timestamp: new Date(Date.now() - 172800000).toISOString(),
        votes: 24,
        userVote: 1,
        comments: []
    }
];

function getPosts() {
    const stored = localStorage.getItem(COMMUNITY_STORAGE_KEY);
    if (stored) {
        let posts = JSON.parse(stored);
        let migrated = false;
        posts = posts.map(p => {
            if (p.likes !== undefined) {
                p.votes = p.likes;
                p.userVote = p.isLiked ? 1 : 0;
                delete p.likes;
                delete p.isLiked;
                migrated = true;
            }
            return p;
        });
        if (migrated) savePosts(posts);
        return reconcilePosts(validatePosts(posts));
    }
    // Set initial data if none exists
    localStorage.setItem(COMMUNITY_STORAGE_KEY, JSON.stringify(initialPosts));
    return initialPosts;
}

function savePosts(posts) {
    const validatedPosts = validatePosts(posts);
    const reconciledPosts = reconcilePosts(validatedPosts);

    localStorage.setItem(
        COMMUNITY_STORAGE_KEY,
        JSON.stringify(reconciledPosts)
    );
}

function validatePosts(posts) {
    return posts.filter(post =>
        post &&
        typeof post.id !== "undefined" &&
        typeof post.title === "string" &&
        typeof post.content === "string"
    );
}

function reconcilePosts(posts) {
    const uniquePosts = new Map();

    posts.forEach(post => {
        const existing = uniquePosts.get(post.id);

        if (!existing) {
            uniquePosts.set(post.id, post);
            return;
        }

        const existingTime = new Date(existing.timestamp).getTime();
        const currentTime = new Date(post.timestamp).getTime();

        if (currentTime > existingTime) {
            uniquePosts.set(post.id, post);
        }
    });

    return Array.from(uniquePosts.values());
}

function sortCommentsByTimestamp(comments = []) {
    return comments.sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );
}

function generateUniquePostId(posts) {
    let id = Date.now();

    while (posts.some(post => post.id === id)) {
        id++;
    }

    return id;
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    // Set flag so if user navigates to index.html, it skips the intro animation
    sessionStorage.setItem('algoInfinityVerse_appLoaded', 'true');
    initNavbar();
    initDarkMode();
    initCommunityFeed();
});

// ===== NAVBAR & UI (Reused logic) =====
function initNavbar() {
    const menuToggle = document.getElementById('menuToggle');
    const navLinks = document.getElementById('navLinks');

    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            const icon = menuToggle.querySelector('i');
            icon.classList.toggle('fa-bars');
            icon.classList.toggle('fa-times');
        });

        // Close menu on link click
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('active');
                const icon = menuToggle.querySelector('i');
                icon.classList.add('fa-bars');
                icon.classList.remove('fa-times');
            });
        });
    }

    // Scroll effect
    window.addEventListener('scroll', () => {
        const navbar = document.querySelector('.navbar');
        if (navbar) {
            if (window.scrollY > 50) {
                navbar.style.background = 'rgba(10, 10, 26, 0.95)';
            } else {
                navbar.style.background = 'rgba(10, 10, 26, 0.95)'; // Keep solid on community page
            }
        }
    });
}

function initDarkMode() {
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
        const isLightMode = localStorage.getItem('algoInfinityVerse_lightMode') === 'true';
        if (isLightMode) {
            document.body.classList.add('light-mode');
            darkModeToggle.querySelector('i').classList.replace('fa-moon', 'fa-sun');
        }

        darkModeToggle.addEventListener('click', () => {
            document.body.classList.toggle('light-mode');
            const icon = darkModeToggle.querySelector('i');
            
            if (document.body.classList.contains('light-mode')) {
                icon.classList.replace('fa-moon', 'fa-sun');
                localStorage.setItem('algoInfinityVerse_lightMode', 'true');
            } else {
                icon.classList.replace('fa-sun', 'fa-moon');
                localStorage.setItem('algoInfinityVerse_lightMode', 'false');
            }
        });
    }
}

// ===== COMMUNITY LOGIC =====
let currentSearchQuery = '';
let currentTagFilter = '';

function initCommunityFeed() {
    renderPosts();
    renderTrendingTags();

    const form = document.getElementById('createPostForm');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            createNewPost();
        });
    }

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentSearchQuery = e.target.value.toLowerCase();
            renderPosts();
        });
    }
}

function setTagFilter(tag) {
    currentTagFilter = tag.toLowerCase();
    const btn = document.getElementById('clearFilterBtn');
    if (btn) btn.style.display = 'inline-block';
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    currentSearchQuery = '';
    renderPosts();
}

function clearTagFilter() {
    currentTagFilter = '';
    const btn = document.getElementById('clearFilterBtn');
    if (btn) btn.style.display = 'none';
    renderPosts();
}

function renderTrendingTags() {
    const container = document.getElementById('trendingTagsContainer');
    if (!container) return;
    
    const posts = getPosts();
    const tagCounts = {};
    
    posts.forEach(p => {
        if (p.tags) {
            p.tags.forEach(tag => {
                const t = tag.toLowerCase().trim();
                if (t) tagCounts[t] = (tagCounts[t] || 0) + 1;
            });
        }
    });
    
    const sortedTags = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
        
    container.innerHTML = sortedTags.length > 0 
        ? sortedTags.map(([tag]) => `<span class="tag" style="cursor:pointer;" onclick="setTagFilter('${tag}')">#${tag}</span>`).join('')
        : '<p class="text-secondary" style="font-size:0.9rem;">No tags yet</p>';
}

function formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function renderPosts() {
    const container = document.getElementById('postsContainer');
    if (!container) return;

    let posts = getPosts();
    
    // Apply Filters
    if (currentTagFilter) {
        posts = posts.filter(p => p.tags && p.tags.some(t => t.toLowerCase().trim() === currentTagFilter));
    }
    if (currentSearchQuery) {
        posts = posts.filter(p => 
            p.title.toLowerCase().includes(currentSearchQuery) || 
            p.content.toLowerCase().includes(currentSearchQuery) ||
            (p.tags && p.tags.some(t => t.toLowerCase().includes(currentSearchQuery)))
        );
    }
    
    container.innerHTML = '';

    if (posts.length === 0) {
        container.innerHTML = '<p class="text-secondary text-center">No posts found.</p>';
        return;
    }

    // Sort by newest first
    posts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    posts.forEach(post => {
        const card = document.createElement('div');
        card.className = 'post-card glass-card animate-in';
        
        let tagsHtml = '';
        if (post.tags && post.tags.length > 0) {
            tagsHtml = '<div class="post-tags">' + 
                post.tags.map(tag => `<span class="post-tag" style="cursor:pointer;" onclick="setTagFilter('${tag}')">#${tag.trim()}</span>`).join('') + 
                '</div>';
        }

        let commentsHtml = '';
        if (post.comments) {
            post.comments = sortCommentsByTimestamp(post.comments);
        }
        if (post.comments && post.comments.length > 0) {
            commentsHtml = post.comments.map(c => `
                <div class="comment">
                    <div class="comment-meta">${formatDate(c.timestamp)}</div>
                    <div class="comment-text">${escapeHtml(c.text)}</div>
                </div>
            `).join('');
        }

        card.innerHTML = `
            <div class="post-header">
                <h4 class="post-title">${escapeHtml(post.title)}</h4>
                <span class="post-meta">${formatDate(post.timestamp)}</span>
            </div>
            <div class="post-content">${escapeHtml(post.content)}</div>
            ${tagsHtml}
            <div class="post-actions" style="display: flex; gap: 15px;">
                <div class="vote-actions" style="display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.05); padding: 4px 10px; border-radius: 20px;">
                    <button class="post-action-btn ${post.userVote === 1 ? 'liked' : ''}" onclick="handleVote(${post.id}, 1)" style="padding: 0; min-width: auto; border: none; background: transparent; transform: scale(1.1); color: ${post.userVote === 1 ? '#22c55e' : 'inherit'};">
                        <i class="fas fa-arrow-up"></i>
                    </button>
                    <span style="font-weight: 500; color: ${post.userVote === 1 ? '#22c55e' : post.userVote === -1 ? '#ef4444' : 'inherit'};">${post.votes !== undefined ? post.votes : 0}</span>
                    <button class="post-action-btn ${post.userVote === -1 ? 'liked' : ''}" onclick="handleVote(${post.id}, -1)" style="padding: 0; min-width: auto; border: none; background: transparent; transform: scale(1.1); color: ${post.userVote === -1 ? '#ef4444' : 'inherit'};">
                        <i class="fas fa-arrow-down"></i>
                    </button>
                </div>
                <button class="post-action-btn" onclick="toggleComments(${post.id})" style="background: rgba(255,255,255,0.05); padding: 4px 15px; border-radius: 20px;">
                    <i class="far fa-comment"></i>
                    <span>${post.comments ? post.comments.length : 0}</span>
                </button>
            </div>
            <div class="comments-section" id="comments-${post.id}">
                <div class="comments-list">
                    ${commentsHtml}
                </div>
                <form class="add-comment-form" onsubmit="addComment(event, ${post.id})">
                    <input type="text" placeholder="Write a comment..." required style="font-family: inherit;">
                    <button type="submit" class="btn btn-primary btn-sm"><i class="fas fa-reply"></i></button>
                </form>
            </div>
        `;
        container.appendChild(card);
    });
}

function createNewPost() {
    const titleInput = document.getElementById('postTitle');
    const contentInput = document.getElementById('postContent');
    const tagsInput = document.getElementById('postTags');

    const title = titleInput.value.trim();
    const content = contentInput.value.trim();
    
    if (!title || !content) return;

    let tags = [];
    if (tagsInput.value.trim()) {
        tags = tagsInput.value.split(',').map(t => t.trim()).filter(t => t);
    }

    let posts = getPosts();
    posts = reconcilePosts(posts);
    const newPost = {
        id: generateUniquePostId(posts), // simple unique id
        title,
        content,
        tags,
        timestamp: new Date().toISOString(),
        votes: 0,
        userVote: 0,
        comments: []
    };

    posts.push(newPost);
    savePosts(posts);

    // Reset form
    titleInput.value = '';
    contentInput.value = '';
    tagsInput.value = '';

    // Re-render
    renderPosts();
    renderTrendingTags();
}

function handleVote(postId, voteValue) {
    let posts = getPosts();
    posts = reconcilePosts(posts);
    const post = posts.find(p => p.id === postId);
    if (post) {
        if (post.userVote === voteValue) {
            // Un-vote
            post.votes -= voteValue;
            post.userVote = 0;
        } else {
            // Change vote or new vote
            post.votes += (voteValue - post.userVote);
            post.userVote = voteValue;
        }
        savePosts(posts);
        renderPosts();
    }
}

function toggleComments(postId) {
    const section = document.getElementById(`comments-${postId}`);
    if (section) {
        section.classList.toggle('active');
    }
}

function addComment(event, postId) {
    event.preventDefault();
    const form = event.target;
    const input = form.querySelector('input');
    const text = input.value.trim();

    if (!text) return;

    let posts = getPosts();
    posts = reconcilePosts(posts);
    const post = posts.find(p => p.id === postId);
    
    if (post) {
        if (!post.comments) post.comments = [];
        post.comments.push({
            text,
            timestamp: new Date().toISOString()
        });
        savePosts(posts);
        
        // Re-render and keep comments open
        renderPosts();
        setTimeout(() => {
            const section = document.getElementById(`comments-${postId}`);
            if (section) section.classList.add('active');
        }, 50);
    }
}

// Utility to prevent XSS in user input
function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}
