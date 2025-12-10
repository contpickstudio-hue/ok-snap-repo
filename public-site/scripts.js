// Load recent posts on homepage
async function loadRecentPosts() {
    try {
        const response = await fetch('recipes.json');
        const recipes = await response.json();
        const postsGrid = document.getElementById('recentPosts');
        
        if (!postsGrid) return;
        
        // Show only the 6 most recent posts
        const recentRecipes = recipes.slice(0, 6);
        
        if (recentRecipes.length === 0) {
            postsGrid.innerHTML = '<p class="no-posts">No recipes yet. Check back soon!</p>';
            return;
        }
        
        postsGrid.innerHTML = recentRecipes.map(recipe => `
            <article class="post-card">
                <div class="post-content">
                    <h3 class="post-title"><a href="blogs/${recipe.slug}.html">${recipe.name}</a></h3>
                    <p class="post-date">Published: ${new Date(recipe.createdAt).toLocaleDateString()}</p>
                    <a href="blogs/${recipe.slug}.html" class="btn btn-secondary">Read Recipe</a>
                </div>
            </article>
        `).join('');
    } catch (error) {
        console.error('Error loading recent posts:', error);
        const postsGrid = document.getElementById('recentPosts');
        if (postsGrid) {
            postsGrid.innerHTML = '<p class="error">Failed to load recipes. Please try again later.</p>';
        }
    }
}

// Load on page load if on homepage
if (document.getElementById('recentPosts')) {
    loadRecentPosts();
}

