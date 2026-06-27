(function() {

    const GIST_ID = 'PUT_YOUR_GIST_ID_HERE';      // ← اینجا با Secret جایگزین میشه
    const GIST_TOKEN = 'PUT_YOUR_GIST_TOKEN_HERE'; // ← اینجا با Secret جایگزین میشه
    // ============================================================

    const PASSWORD_HASH = '49d0226ac8c0d68837d9a2ec8fa9e826d8a0f70f5e1c3cdb66cf869127c769c1';
    const LOCAL_STORAGE_KEY = 'cafe_menu_backup';

    // ---------- متغیرهای اصلی (سراسری) ----------
    let products = [];
    let categories = [];
    let currentFilter = 'همه';
    let editingId = null;
    let isLoggedIn = false;
    let timerInterval = null;
    let timerSeconds = 20;
    let captchaAnswer = 0;

    // ---------- المنت‌ها ----------
    const grid = document.getElementById('productGrid');
    const adminPanel = document.getElementById('adminPanel');
    const toggleBtn = document.getElementById('adminToggle');
    const saveBtn = document.getElementById('saveProductBtn');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    const editIdSpan = document.getElementById('editId');
    const statusIcon = document.getElementById('statusIcon');

    const nameInput = document.getElementById('productName');
    const priceInput = document.getElementById('productPrice');
    const imageInput = document.getElementById('productImage');
    const descInput = document.getElementById('productDesc');
    const categorySelect = document.getElementById('productCategory');

    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const loginOverlay = document.getElementById('loginOverlay');
    const loginPassword = document.getElementById('loginPassword');
    const loginSubmitBtn = document.getElementById('loginSubmitBtn');
    const loginError = document.getElementById('loginError');
    const captchaInput = document.getElementById('captchaInput');
    const captchaQuestion = document.getElementById('captchaQuestion');
    const timerDisplay = document.getElementById('timerDisplay');

    // ============================================================
    // توابع کمکی
    // ============================================================
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function hashPassword(password) {
        return CryptoJS.SHA256(password).toString();
    }

    function saveBackupToLocal() {
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({
                products: products,
                categories: categories
            }));
        } catch (e) {
            console.warn('خطا در ذخیره پشتیبان محلی:', e);
        }
    }

    function loadBackupFromLocal() {
        try {
            const data = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (data) {
                const parsed = JSON.parse(data);
                if (parsed.products && parsed.categories) {
                    products = parsed.products;
                    categories = parsed.categories;
                    return true;
                }
            }
        } catch (e) {
            console.warn('خطا در بازیابی پشتیبان محلی:', e);
        }
        return false;
    }

    function setStatus(message, type = '') {
        if (!statusIcon) return;
        statusIcon.classList.remove('connected', 'loading', 'error');
        if (type === 'loading') {
            statusIcon.classList.add('loading');
            statusIcon.title = '⏳ در حال بارگذاری...';
        } else if (type === 'error') {
            statusIcon.classList.add('error');
            statusIcon.title = '❌ ' + message;
        } else {
            statusIcon.classList.add('connected');
            statusIcon.title = '✅ متصل به دیتابیس';
        }
    }

    function generateCaptcha() {
        const num1 = Math.floor(Math.random() * 9) + 1;
        const num2 = Math.floor(Math.random() * 9) + 1;
        const operator = ['+', '-'][Math.floor(Math.random() * 2)];
        let answer;
        if (operator === '+') {
            answer = num1 + num2;
        } else {
            if (num1 < num2) return generateCaptcha();
            answer = num1 - num2;
        }
        captchaQuestion.textContent = `? = ${num2} ${operator} ${num1} `;
        captchaAnswer = answer;
        return answer;
    }

    function startTimer() {
        timerSeconds = 20;
        timerDisplay.textContent = timerSeconds;
        loginSubmitBtn.disabled = true;
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            timerSeconds--;
            timerDisplay.textContent = timerSeconds;
            if (timerSeconds <= 0) {
                clearInterval(timerInterval);
                timerInterval = null;
                loginSubmitBtn.disabled = false;
                timerDisplay.textContent = '✓';
            }
        }, 1000);
    }

    // ============================================================
    // 📡 ارتباط با Gist API
    // ============================================================
    async function fetchFromGist() {
        try {
            console.log('🔄 fetchFromGist شروع شد...');
            console.log('📡 GIST_ID:', GIST_ID);
            console.log('📡 GIST_TOKEN:', GIST_TOKEN ? '✅ توکن وجود دارد' : '❌ توکن خالی است');
            
            setStatus('⏳ در حال دریافت منو از سرور...', 'loading');
            const response = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
                headers: {
                    'Authorization': `token ${GIST_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            console.log('📡 وضعیت پاسخ:', response.status);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status} - ${response.statusText}`);
            }

            const data = await response.json();
            const files = data.files;
            const firstFile = Object.values(files)[0];
            
            if (!firstFile) {
                throw new Error('فایلی در Gist یافت نشد');
            }

            const content = JSON.parse(firstFile.content);
            console.log('📦 محتوای Gist:', content);
            
            products = content.products || [];
            categories = content.categories || ['نوشیدنی', 'غذا', 'دسر'];
            
            saveBackupToLocal();
            
            setStatus('✅ متصل به دیتابیس', '');
            
            renderCategories();
            renderCategoryFilter();
            renderProducts();
            console.log('✅ fetchFromGist با موفقیت کامل شد');
            return true;
        } catch (error) {
            console.error('❌ Gist fetch error:', error);
            
            if (loadBackupFromLocal()) {
                setStatus('⚠️ استفاده از پشتیبان محلی', 'error');
                renderCategories();
                renderCategoryFilter();
                renderProducts();
                return true;
            } else {
                setStatus('⚠️ بدون دیتا', 'error');
                products = [];
                categories = ['نوشیدنی', 'غذا', 'دسر'];
                renderCategories();
                renderCategoryFilter();
                renderProducts();
                return false;
            }
        }
    }

    async function saveToGist() {
        try {
            setStatus('⏳ در حال ذخیره روی سرور...', 'loading');
            
            const payload = {
                files: {
                    'products.json': {
                        content: JSON.stringify({ 
                            products: products,
                            categories: categories 
                        }, null, 2)
                    }
                }
            };

            const response = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `token ${GIST_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            saveBackupToLocal();
            setStatus('✅ ذخیره شد!', '');
            return true;
        } catch (error) {
            console.error('Gist save error:', error);
            setStatus('⚠️ خطا در ذخیره روی سرور', 'error');
            return false;
        }
    }

    // ============================================================
    // مدیریت دسته‌بندی‌ها
    // ============================================================
    function renderCategories() {
        const categorySelect = document.getElementById('productCategory');
        const categoryList = document.getElementById('categoryList');
        
        if (categorySelect) {
            const currentValue = categorySelect.value;
            categorySelect.innerHTML = '<option value="">انتخاب دسته‌بندی...</option>';
            categories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat;
                option.textContent = cat;
                categorySelect.appendChild(option);
            });
            if (currentValue && categories.includes(currentValue)) {
                categorySelect.value = currentValue;
            }
        }
        
        if (categoryList) {
            categoryList.innerHTML = '';
            categories.forEach(cat => {
                const tag = document.createElement('span');
                tag.className = 'category-tag';
                tag.innerHTML = `
                    ${escapeHtml(cat)}
                    <button class="remove-cat" data-category="${escapeHtml(cat)}">✕</button>
                `;
                categoryList.appendChild(tag);
            });
            
            categoryList.querySelectorAll('.remove-cat').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const cat = btn.dataset.category;
                    if (categories.length <= 1) {
                        alert('حداقل یک دسته‌بندی باید وجود داشته باشد.');
                        return;
                    }
                    if (confirm(`آیا از حذف دسته‌بندی "${cat}" مطمئنید؟`)) {
                        categories = categories.filter(c => c !== cat);
                        products.forEach(p => {
                            if (p.category === cat) p.category = '';
                        });
                        await saveToGist();
                        renderCategories();
                        renderCategoryFilter();
                        renderProducts();
                    }
                });
            });
        }
    }

    function renderCategoryFilter() {
        let filterContainer = document.getElementById('categoryFilter');
        
        if (!filterContainer) {
            filterContainer = document.createElement('div');
            filterContainer.id = 'categoryFilter';
            filterContainer.className = 'category-filter';
            grid.parentNode.insertBefore(filterContainer, grid);
        }
        
        filterContainer.innerHTML = `
            <button class="filter-btn active" data-category="همه">همه</button>
            ${categories.map(cat => 
                `<button class="filter-btn" data-category="${escapeHtml(cat)}">${escapeHtml(cat)}</button>`
            ).join('')}
        `;
        
        filterContainer.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                filterContainer.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentFilter = btn.dataset.category;
                renderProducts();
            });
        });
    }

    // ============================================================
    // مدیریت محصولات
    // ============================================================
    async function addProduct(name, price, image, desc, category) {
        const newProduct = {
            id: Date.now() + Math.random(),
            name: name.trim(),
            price: price.trim(),
            image: image.trim(),
            desc: desc.trim(),
            category: category || ''
        };
        products.push(newProduct);
        await saveToGist();
        renderProducts();
        clearForm();
    }

    async function updateProduct(id, name, price, image, desc, category) {
        const index = products.findIndex(p => p.id === id);
        if (index !== -1) {
            products[index] = {
                ...products[index],
                name: name.trim(),
                price: price.trim(),
                image: image.trim(),
                desc: desc.trim(),
                category: category || ''
            };
            await saveToGist();
            renderProducts();
            clearForm();
            editingId = null;
            editIdSpan.style.display = 'none';
            cancelEditBtn.style.display = 'none';
            saveBtn.textContent = '✅ ذخیره محصول';
        }
    }

    async function deleteProduct(id) {
        const index = products.findIndex(p => p.id === id);
        if (index !== -1) {
            products = products.filter(p => p.id !== id);
            await saveToGist();
            renderProducts();
            if (editingId === id) {
                clearForm();
                editingId = null;
                editIdSpan.style.display = 'none';
                cancelEditBtn.style.display = 'none';
                saveBtn.textContent = '✅ ذخیره محصول';
            }
        }
    }

    // ============================================================
    // رندر محصولات
    // ============================================================
    function renderProducts() {
        console.log('🔄 renderProducts اجرا شد، تعداد محصولات:', products.length);
        
        const filtered = currentFilter === 'همه' 
            ? products 
            : products.filter(p => p.category === currentFilter);
        
        if (!filtered || !filtered.length) {
            grid.innerHTML = `<div class="empty-state">🍃 هیچ محصولی در این دسته‌بندی وجود ندارد</div>`;
            return;
        }
        
        let html = '';
        filtered.forEach((p, index) => {
            const delay = (index % 6) * 0.07;
            html += `
                <div class="product-card" style="animation-delay: ${delay}s;">
                    <img class="image" src="${p.image || 'https://picsum.photos/seed/default/400/300'}" alt="${p.name}" loading="lazy" onerror="this.src='https://picsum.photos/seed/fallback/400/300'" />
                    ${p.category ? `<div class="product-category">${escapeHtml(p.category)}</div>` : ''}
                    <div class="name">${escapeHtml(p.name)}</div>
                    <div class="price">${escapeHtml(p.price)} تومان</div>
                    <div class="desc">${escapeHtml(p.desc || '')}</div>
                    <div class="actions">
                        ${isLoggedIn ? `
                            <button class="btn-edit" data-id="${p.id}">✎ ویرایش</button>
                            <button class="btn-danger" data-id="${p.id}">🗑 حذف</button>
                        ` : ''}
                    </div>
                </div>
            `;
        });
        grid.innerHTML = html;

        if (isLoggedIn) {
            grid.querySelectorAll('.btn-edit').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = Number(btn.dataset.id);
                    startEdit(id);
                });
            });
            grid.querySelectorAll('.btn-danger').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = Number(btn.dataset.id);
                    if (confirm('آیا از حذف این محصول مطمئنید؟')) {
                        deleteProduct(id);
                    }
                });
            });
        }
    }

    // ============================================================
    // شروع ویرایش
    // ============================================================
    function startEdit(id) {
        if (!isLoggedIn) return;
        const product = products.find(p => p.id === id);
        if (!product) return;

        editingId = id;
        nameInput.value = product.name;
        priceInput.value = product.price;
        imageInput.value = product.image || '';
        descInput.value = product.desc || '';
        categorySelect.value = product.category || '';

        editIdSpan.textContent = id;
        editIdSpan.style.display = 'inline';
        cancelEditBtn.style.display = 'inline-block';
        saveBtn.textContent = '✏️ بروزرسانی';

        adminPanel.classList.add('active');
        toggleBtn.textContent = '🗂 بستن مدیریت';
        nameInput.focus();
    }

    function clearForm() {
        nameInput.value = '';
        priceInput.value = '';
        imageInput.value = '';
        descInput.value = '';
        categorySelect.value = '';
        editingId = null;
        editIdSpan.style.display = 'none';
        cancelEditBtn.style.display = 'none';
        saveBtn.textContent = '✅ ذخیره محصول';
    }

    // ============================================================
    // لاگین
    // ============================================================
    function login(password) {
        const enteredHash = hashPassword(password);
        const captchaValue = parseInt(captchaInput.value);
        
        if (captchaValue !== captchaAnswer) {
            loginError.textContent = '❌ جواب کپچا اشتباه است';
            generateCaptcha();
            captchaInput.value = '';
            return false;
        }
        
        if (enteredHash === PASSWORD_HASH) {
            isLoggedIn = true;
            sessionStorage.setItem('cafe_admin_logged', 'true');
            loginOverlay.classList.remove('active');
            loginError.textContent = '';
            loginPassword.value = '';
            captchaInput.value = '';
            updateUI();
            return true;
        } else {
            loginError.textContent = '❌ رمز عبور اشتباه است';
            generateCaptcha();
            captchaInput.value = '';
            return false;
        }
    }

    function logout() {
        isLoggedIn = false;
        sessionStorage.removeItem('cafe_admin_logged');
        adminPanel.classList.remove('active');
        toggleBtn.textContent = '🛠 مدیریت منو';
        updateUI();
        clearForm();
    }

    function checkLoginStatus() {
        const stored = sessionStorage.getItem('cafe_admin_logged');
        isLoggedIn = (stored === 'true');
        updateUI();
    }

    function updateUI() {
        if (isLoggedIn) {
            loginBtn.classList.add('hidden');
            logoutBtn.classList.remove('hidden');
            toggleBtn.classList.remove('hidden');
        } else {
            loginBtn.classList.remove('hidden');
            logoutBtn.classList.add('hidden');
            toggleBtn.classList.add('hidden');
            adminPanel.classList.remove('active');
            toggleBtn.textContent = '🛠 مدیریت منو';
        }
        renderProducts();
    }

    // ============================================================
    // رویدادها
    // ============================================================
    loginBtn.addEventListener('click', () => {
        loginOverlay.classList.add('active');
        generateCaptcha();
        startTimer();
        loginPassword.value = '';
        captchaInput.value = '';
        loginError.textContent = '';
        loginPassword.focus();
    });

    loginSubmitBtn.addEventListener('click', () => {
        login(loginPassword.value);
    });

    loginPassword.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') login(loginPassword.value);
    });

    captchaInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') login(loginPassword.value);
    });

    loginOverlay.addEventListener('click', (e) => {
        if (e.target === loginOverlay) {
            loginOverlay.classList.remove('active');
            if (timerInterval) clearInterval(timerInterval);
            loginError.textContent = '';
            loginPassword.value = '';
            captchaInput.value = '';
        }
    });

    logoutBtn.addEventListener('click', logout);

    toggleBtn.addEventListener('click', () => {
        if (!isLoggedIn) return;
        const isActive = adminPanel.classList.toggle('active');
        toggleBtn.textContent = isActive ? '🗂 بستن مدیریت' : '🛠 مدیریت منو';
        if (!isActive) clearForm();
    });

    saveBtn.addEventListener('click', async () => {
        if (!isLoggedIn) return;
        const name = nameInput.value.trim();
        const price = priceInput.value.trim();
        const image = imageInput.value.trim();
        const desc = descInput.value.trim();
        const category = categorySelect.value;

        if (!name || !price) {
            alert('لطفاً نام و قیمت محصول را وارد کنید.');
            return;
        }

        if (editingId !== null) {
            await updateProduct(editingId, name, price, image, desc, category);
        } else {
            await addProduct(name, price, image, desc, category);
        }
    });

    cancelEditBtn.addEventListener('click', () => {
        clearForm();
        editingId = null;
        editIdSpan.style.display = 'none';
        cancelEditBtn.style.display = 'none';
        saveBtn.textContent = '✅ ذخیره محصول';
    });

    document.getElementById('addCategoryBtn')?.addEventListener('click', async () => {
        const input = document.getElementById('newCategoryName');
        const name = input.value.trim();
        if (!name) {
            alert('لطفاً نام دسته‌بندی را وارد کنید.');
            return;
        }
        if (categories.includes(name)) {
            alert('این دسته‌بندی قبلاً وجود دارد.');
            return;
        }
        categories.push(name);
        await saveToGist();
        renderCategories();
        renderCategoryFilter();
        renderProducts();
        input.value = '';
    });

    document.getElementById('newCategoryName')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('addCategoryBtn').click();
        }
    });

    // ============================================================
    // راه‌اندازی اولیه
    // ============================================================
    checkLoginStatus();

    // ===== شرط برای دیباگ =====
    const isGistConfigured = GIST_ID !== 'PUT_YOUR_GIST_ID_HERE' && GIST_TOKEN !== 'PUT_YOUR_GIST_TOKEN_HERE';
    console.log('📡 آیا Gist تنظیم شده؟', isGistConfigured);
    console.log('📡 GIST_ID:', GIST_ID);
    console.log('📡 GIST_TOKEN:', GIST_TOKEN ? '✅ توکن وجود دارد' : '❌ توکن خالی است');

    if (isGistConfigured) {
        console.log('🔄 در حال دریافت از Gist...');
        fetchFromGist();
    } else {
        console.log('⚠️ Gist تنظیم نشده، از دیتای پیش‌فرض استفاده میشود.');
        setStatus('⚠️ لطفاً Gist ID و Token را در فایل script.js تنظیم کنید.', 'error');
        grid.innerHTML = `<div class="empty-state">⚙️ ابتدا تنظیمات دیتابیس را کامل کنید</div>`;
        categories = ['نوشیدنی', 'غذا', 'دسر'];
        renderCategories();
        renderCategoryFilter();
    }
})();