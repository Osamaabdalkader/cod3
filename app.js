// نظام الإحالة المتكامل
class ReferralSystem {
  constructor() {
    this.currentUser = null;
    this.userData = null;
    this.init();
  }

  init() {
    // التحقق من حالة المصادقة
    firebase.auth().onAuthStateChanged((user) => {
      this.currentUser = user;
      if (user) {
        this.loadUserData(user.uid);
        this.updateAuthUI(true);
      } else {
        this.updateAuthUI(false);
        // إذا لم يكن في صفحة تسجيل الدخول، إعادة التوجيه
        if (!window.location.pathname.includes('login.html') && 
            !window.location.pathname.includes('register.html') &&
            !window.location.pathname.includes('index.html')) {
          window.location.href = 'index.html';
        }
      }
    });

    // إعداد معالج الأحداث
    this.setupEventListeners();
  }

  setupEventListeners() {
    // تسجيل الدخول
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleLogin();
      });
    }

    // إنشاء حساب
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
      registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleRegister();
      });
    }

    // تسجيل الخروج
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        this.handleLogout();
      });
    }

    // نسخ رابط الإحالة
    const copyBtn = document.getElementById('copy-link-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        this.copyReferralLink();
      });
    }
  }

  async handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const alert = document.getElementById('login-alert');
    
    if (!email || !password) {
      this.showAlert(alert, 'error', 'يرجى ملء جميع الحقول');
      return;
    }
    
    try {
      this.showAlert(alert, 'info', 'جاري تسجيل الدخول...');
      const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
      this.showAlert(alert, 'success', 'تم تسجيل الدخول بنجاح');
      
      // تحميل بيانات المستخدم
      await this.loadUserData(userCredential.user.uid);
      
      // الانتقال إلى لوحة التحكم بعد ثانية
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 1000);
      
    } catch (error) {
      this.showAlert(alert, 'error', error.message);
    }
  }

  async handleRegister() {
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const referralCode = document.getElementById('referral-code').value;
    const alert = document.getElementById('register-alert');
    
    if (!name || !email || !password) {
      this.showAlert(alert, 'error', 'يرجى ملء جميع الحقول الإلزامية');
      return;
    }
    
    try {
      this.showAlert(alert, 'info', 'جاري إنشاء الحساب...');
      
      // إنشاء المستخدم في Authentication
      const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
      const userId = userCredential.user.uid;
      
      // إنشاء رمز إحالة فريد
      const userReferralCode = this.generateReferralCode();
      
      // حفظ بيانات المستخدم في Realtime Database
      await firebase.database().ref('users/' + userId).set({
        name: name,
        email: email,
        referralCode: userReferralCode,
        points: 0,
        joinDate: new Date().toISOString(),
        referredBy: referralCode || null
      });
      
      // حفظ رمز الإحالة للبحث السريع
      await firebase.database().ref('referralCodes/' + userReferralCode).set(userId);
      
      // إذا كان هناك رمز إحالة، إضافة العلاقة
      if (referralCode) {
        await this.processReferral(referralCode, userId, name, email);
      }
      
      this.showAlert(alert, 'success', 'تم إنشاء الحساب بنجاح');
      
      // الانتقال إلى لوحة التحكم بعد ثانية
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 1000);
      
    } catch (error) {
      this.showAlert(alert, 'error', error.message);
    }
  }

  async processReferral(referralCode, newUserId, name, email) {
    try {
      // البحث عن صاحب رمز الإحالة
      const referrerId = await this.getUserIdFromReferralCode(referralCode);
      if (!referrerId) return;
      
      // إضافة المستخدم الجديد إلى قائمة إحالات المُحيل
      await firebase.database().ref('userReferrals/' + referrerId + '/' + newUserId).set({
        name: name,
        email: email,
        joinDate: new Date().toISOString(),
        level: 1
      });
      
      // منح نقاط للمُحيل
      await firebase.database().ref('users/' + referrerId + '/points').transaction(points => (points || 0) + 10);
      
      // تحديث إحصائيات المُحيل
      await this.updateReferrerStats(referrerId);
      
    } catch (error) {
      console.error("Error processing referral:", error);
    }
  }

  async loadUserData(userId) {
    try {
      const snapshot = await firebase.database().ref('users/' + userId).once('value');
      this.userData = snapshot.val();
      
      if (this.userData) {
        this.updateUserUI();
        
        // إذا كانت صفحة الشبكة، تحميل الشبكة
        if (window.location.pathname.includes('network.html')) {
          this.loadNetwork();
        }
        
        // إذا كانت صفحة الإدارة، تحميل بيانات الإدارة
        if (window.location.pathname.includes('management.html')) {
          this.loadManagementData();
        }
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    }
  }

  updateUserUI() {
    // تحديث البيانات في واجهة المستخدم
    const usernameEl = document.getElementById('username');
    const userAvatar = document.getElementById('user-avatar');
    const referralsCount = document.getElementById('referrals-count');
    const pointsCount = document.getElementById('points-count');
    const joinDate = document.getElementById('join-date');
    const referralLink = document.getElementById('referral-link');
    
    if (usernameEl) usernameEl.textContent = this.userData.name;
    if (userAvatar) userAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(this.userData.name)}&background=random`;
    if (pointsCount) pointsCount.textContent = this.userData.points || '0';
    if (joinDate) joinDate.textContent = new Date(this.userData.joinDate).toLocaleDateString('ar-SA');
    if (referralLink) referralLink.value = `${window.location.origin}?ref=${this.userData.referralCode}`;
    
    // تحميل عدد الإحالات
    if (referralsCount && this.currentUser) {
      this.loadReferralsCount(this.currentUser.uid).then(count => {
        referralsCount.textContent = count;
      });
    }
  }

  async loadReferralsCount(userId) {
    try {
      const snapshot = await firebase.database().ref('userReferrals/' + userId).once('value');
      return snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
    } catch (error) {
      console.error("Error loading referrals count:", error);
      return 0;
    }
  }

  async loadNetwork() {
    const networkContainer = document.getElementById('network-container');
    if (!networkContainer || !this.currentUser) return;
    
    networkContainer.innerHTML = '<div class="loading">جاري تحميل الشبكة...</div>';
    
    try {
      // تحميل الشبكة الكاملة
      const network = {};
      await this.loadNetworkRecursive(this.currentUser.uid, network, 0, 10);
      
      // عرض الشبكة
      this.renderNetwork(network, networkContainer);
      
    } catch (error) {
      console.error("Error loading network:", error);
      networkContainer.innerHTML = '<div class="error">فشل في تحميل الشبكة</div>';
    }
  }

  async loadNetworkRecursive(userId, network, currentLevel, maxLevel) {
    if (currentLevel > maxLevel) return;
    
    try {
      const snapshot = await firebase.database().ref('userReferrals/' + userId).once('value');
      if (!snapshot.exists()) return;
      
      const referrals = snapshot.val();
      network[userId] = {
        level: currentLevel,
        referrals: {}
      };
      
      // تحميل بيانات المستخدم إذا لم تكن موجودة مسبقًا
      if (!this.userDataCache) this.userDataCache = {};
      if (!this.userDataCache[userId]) {
        const userSnapshot = await firebase.database().ref('users/' + userId).once('value');
        this.userDataCache[userId] = userSnapshot.val();
      }
      
      network[userId].data = this.userDataCache[userId];
      
      // تحميل الإحالات بشكل متكرر
      for (const referredUserId in referrals) {
        network[userId].referrals[referredUserId] = {
          data: referrals[referredUserId],
          level: currentLevel + 1
        };
        
        await this.loadNetworkRecursive(
          referredUserId, 
          network[userId].referrals, 
          currentLevel + 1, 
          maxLevel
        );
      }
    } catch (error) {
      console.error("Error loading network recursively:", error);
    }
  }

  renderNetwork(network, container) {
    container.innerHTML = '';
    
    if (!network || Object.keys(network).length === 0) {
      container.innerHTML = '<div class="empty-state">لا توجد إحالات حتى الآن</div>';
      return;
    }
    
    // البدء من المستخدم الحالي
    this.renderNetworkNode(this.currentUser.uid, network, container, 0);
  }

  renderNetworkNode(userId, network, container, level) {
    if (!network[userId]) return;
    
    const nodeData = network[userId].data;
    const referrals = network[userId].referrals;
    
    const nodeElement = document.createElement('div');
    nodeElement.className = `network-node level-${level}`;
    
    nodeElement.innerHTML = `
      <div class="node-header">
        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(nodeData.name)}&background=random" alt="صورة المستخدم">
        <div class="node-info">
          <h4>${nodeData.name}</h4>
          <p>${nodeData.email}</p>
          <span class="user-level">المستوى: ${level}</span>
        </div>
        <div class="node-stats">
          <span class="points">${nodeData.points || 0} نقطة</span>
        </div>
      </div>
    `;
    
    // إذا كان هناك إحالات، إضافة زر للتوسيع
    if (referrals && Object.keys(referrals).length > 0) {
      const expandBtn = document.createElement('button');
      expandBtn.className = 'expand-btn';
      expandBtn.innerHTML = `<i class="fas fa-chevron-down"></i> ${Object.keys(referrals).length} إحالة`;
      expandBtn.onclick = () => this.toggleNodeExpansion(nodeElement, referrals, level + 1);
      nodeElement.appendChild(expandBtn);
    }
    
    container.appendChild(nodeElement);
  }

  toggleNodeExpansion(node, referrals, level) {
    const childrenContainer = node.querySelector('.node-children');
    
    if (childrenContainer) {
      // إذا كان هناك حاوية أطفال بالفعل، قم بالتبديل
      childrenContainer.style.display = childrenContainer.style.display === 'none' ? 'block' : 'none';
    } else {
      // إذا لم تكن هناك حاوية أطفال، قم بإنشائها وعرضها
      const newChildrenContainer = document.createElement('div');
      newChildrenContainer.className = 'node-children';
      
      for (const referredUserId in referrals) {
        this.renderNetworkNode(referredUserId, referrals, newChildrenContainer, level);
      }
      
      node.appendChild(newChildrenContainer);
    }
  }

  async loadManagementData() {
    if (!this.currentUser) return;
    
    try {
      // تحميل الإحالات المباشرة
      const snapshot = await firebase.database().ref('userReferrals/' + this.currentUser.uid).once('value');
      const membersTable = document.getElementById('network-members');
      
      if (!snapshot.exists()) {
        membersTable.innerHTML = '<tr><td colspan="7" style="text-align: center;">لا توجد إحالات حتى الآن</td></tr>';
        return;
      }
      
      const referrals = snapshot.val();
      membersTable.innerHTML = '';
      
      // تحميل بيانات كل مستخدم مُحال
      for (const userId in referrals) {
        const userSnapshot = await firebase.database().ref('users/' + userId).once('value');
        const userData = userSnapshot.val();
        
        if (userData) {
          const row = membersTable.insertRow();
          row.innerHTML = `
            <td>${userData.name}</td>
            <td>${userData.email}</td>
            <td><span class="user-badge level-0">مستوى 1</span></td>
            <td>${new Date(userData.joinDate).toLocaleDateString('ar-SA')}</td>
            <td>${await this.loadReferralsCount(userId)}</td>
            <td>${userData.points || 0}</td>
            <td>
              <button class="action-btn" onclick="app.sendMessage('${userData.email}')"><i class="fas fa-envelope"></i></button>
              <button class="action-btn" onclick="app.viewDetails('${userId}')"><i class="fas fa-eye"></i></button>
            </td>
          `;
        }
      }
    } catch (error) {
      console.error("Error loading management data:", error);
    }
  }

  generateReferralCode() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  }

  async getUserIdFromReferralCode(referralCode) {
    try {
      const snapshot = await firebase.database().ref('referralCodes/' + referralCode).once('value');
      return snapshot.val();
    } catch (error) {
      console.error("Error getting user ID from referral code:", error);
      return null;
    }
  }

  async updateReferrerStats(referrerId) {
    try {
      // حساب عدد الإحالات الكلي
      const snapshot = await firebase.database().ref('userReferrals/' + referrerId).once('value');
      const referralsCount = snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
      
      // تحديث عدد الإحالات
      await firebase.database().ref('users/' + referrerId + '/referralsCount').set(referralsCount);
      
    } catch (error) {
      console.error("Error updating referrer stats:", error);
    }
  }

  copyReferralLink() {
    const referralLink = document.getElementById('referral-link');
    if (!referralLink) return;
    
    referralLink.select();
    document.execCommand('copy');
    alert('تم نسخ رابط الإحالة!');
  }

  updateAuthUI(isLoggedIn) {
    const authElements = document.querySelectorAll('.auth-only');
    const unauthElements = document.querySelectorAll('.unauth-only');
    
    if (isLoggedIn) {
      authElements.forEach(el => el.style.display = 'block');
      unauthElements.forEach(el => el.style.display = 'none');
    } else {
      authElements.forEach(el => el.style.display = 'none');
      unauthElements.forEach(el => el.style.display = 'block');
    }
  }

  async handleLogout() {
    try {
      await firebase.auth().signOut();
      window.location.href = 'index.html';
    } catch (error) {
      console.error("Error signing out:", error);
    }
  }

  showAlert(element, type, message) {
    if (!element) return;
    
    element.textContent = message;
    element.className = `alert alert-${type}`;
    element.style.display = 'block';
    
    setTimeout(() => {
      element.style.display = 'none';
    }, 3000);
  }

  // وظائف مساعدة للإدارة
  sendMessage(email) {
    alert(`سيتم إرسال رسالة إلى: ${email}`);
    // يمكن تنفيذ إرسال رسالة هنا
  }

  viewDetails(userId) {
    alert(`عرض تفاصيل المستخدم: ${userId}`);
    // يمكن تنفيذ عرض التفاصيل هنا
  }
}

// تهيئة التطبيق
const app = new ReferralSystem();