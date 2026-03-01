(async function () {
    const SCORE_THRESHOLDS = [
        {border: 999910, scoreName: 'SDP', className: 'sakamoto-sdp'},
        {border: 990000, scoreName: '990k+', className: 'sakamoto-aaa'},
        {border: 950000, scoreName: '950k+', className: 'sakamoto-aa'},
        {border: 900000, scoreName: '900k+', className: 'sakamoto-aa'},
        {border: 850000, scoreName: '850k+', className: 'sakamoto-a'},
        {border: 800000, scoreName: '800k+', className: 'sakamoto-a'},
    ];
    const LAMP_THRESHOLDS = [
        {border: 6, lampName: 'MFC', className: 'sakamoto-mfc'},        
        {border: 5, lampName: 'PFC', className: 'sakamoto-pfc'},
        {border: 4, lampName: 'GFC', className: 'sakamoto-gfc'},
        {border: 3, lampName: 'FC', className: 'sakamoto-fc'},
        {border: 2, lampName: 'LIFE4', className: 'sakamoto-life4'},
        {border: 1, lampName: 'CLEAR', className: 'sakamoto-clear'}
    ];

    const allScores = [];
    const allLamps = [];
    const seenRanks = new Set();
    const seenPlayerNames = new Set();
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    function parseScore(text) {
        if (!text) return NaN;
        return parseInt(text.replace(/,/g, ""), 10);
    }

    function getCurrentPageIndex() {
        const selected = document.querySelector('#div-ranking-page-nav .btn-page-item.selected');
        if (!selected) return 0;
        return parseInt(selected.id.replace('btn-page-', ''), 10) || 0;
    }

    // 検索ボタンを除いたページボタンの数をもとに総ページ数を取得する
    function getTotalPages() {
        const buttons = document.querySelectorAll(
            '#div-ranking-page-nav .btn-page-item[id^="btn-page-"]'
        );
        return Array.from(buttons).filter(b => b.id !== 'btn-page-search').length;
    }

    // スピナーの表示が消え、ランキングの表示が完了したか
    function hasRealRankingData() {
        const spinner = document.querySelector('.tr-ranking-spinner');
        if (spinner) return false;
        return !!document.querySelector('.sp-ranking-score');
    }

    // ランキングの表示が完了するまで待機する
    async function waitForRealRanking(timeout = 10000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            if (hasRealRankingData()) return true;
            await sleep(80);
        }
        return false;
    }

    // スコアとクリア種別を抽出する
    function extractScores() {
        // スピナーを除いたランキング各行を取得
        const rows = document.querySelectorAll('.tbl-ranking tbody tr:not(.tr-ranking-spinner)');
        let added = 0;

        rows.forEach(row => {
            const rank = row.querySelector('.sp-ranking-num')?.textContent.trim();
            const playerName = row.querySelector('.sp-ranking-name')?.textContent.trim();
            const scoreText = row.querySelector('.td-ranking-score .sp-ranking-score')?.textContent.trim();
            const score = parseScore(scoreText);
            const gradeCell = row.querySelector('.td-ranking-grade');
            const lamp = judgeLamp(gradeCell);

            if (!rank || isNaN(score)) return;

            let rankAdded = false;
            let playerNameAdded = false;

            if (!seenRanks.has(rank)) {
                seenRanks.add(rank);
                rankAdded = true;
            }

            if (!seenPlayerNames.has(playerName)) {
                seenPlayerNames.add(playerName);
                playerNameAdded = true;
            }

            // 順位かプレイヤー名が新規のものならば有効値として集計対象にする
            if (rankAdded || playerNameAdded) {                
                allScores.push(score);
                allLamps.push(lamp);
                added++;
            }
        });

        return added;
    }

    async function gotoPageFast(pageIndex) {
        if (typeof window.gotoPage === "function") {
            window.gotoPage(pageIndex);
        } else {
            document.getElementById(`btn-page-${pageIndex}`)?.click();
        }
        await waitForRealRanking();
    }

    // バックグラウンドで全ページを閲覧しスコアを抽出する
    async function collectAllPagesInBackground() {
        const totalPages = getTotalPages();
        const originalPage = getCurrentPageIndex();

        await waitForRealRanking();
        extractScores();

        for (let i = 0; i < totalPages; i++) {
            if (i === originalPage) continue;
            await gotoPageFast(i);
            extractScores();
        }

        // 元のページに復元（見た目維持）
        await gotoPageFast(originalPage);
    }

    function formatNumber(n) {
        return n.toLocaleString();
    }

    // スコア条件を満たした件数を集計する
    function calculateScoreStats() {
        const scoreTotal = allScores.length;
        const scoreResults = [];

        SCORE_THRESHOLDS.forEach(threshold => {
            const count = allScores.filter(s => s >= threshold.border).length;
            const ratio = scoreTotal ? ((count / scoreTotal) * 100).toFixed(2) : "0.00";
            scoreResults.push({
                threshold,
                count,
                ratio
            });
        });

        return { scoreTotal, scoreResults };
    }
    
    // クリア種別条件を満たした件数を集計する
    function calculateLampStats() {
        const lampTotal = allLamps.length;
        const lampResults = [];

        LAMP_THRESHOLDS.forEach(threshold => {
            const count = allLamps.filter(s => s >= threshold.border).length;
            const ratio = lampTotal ? ((count / lampTotal) * 100).toFixed(2) : "0.00";
            lampResults.push({
                threshold,
                count,
                ratio
            });
        });

        return { lampTotal, lampResults };
    }

    // クリア種別を判定する
    function judgeLamp(gradeCell) {
        const imgs = gradeCell.querySelectorAll('img');

        if (imgs.length >= 2) {
            const lampSrc = imgs[1].getAttribute('src');
            const match = lampSrc.match(/lamp_(\d)\.png/);
            if (match) {
                const lamp = parseInt(match[1], 10);
                if (lamp === 6) return 6;
                if (lamp === 5) return 5;
                if (lamp === 4) return 4;
                if (lamp === 3) return 3;
                if (lamp === 2) return 2;
            }
        }

        if (imgs.length >= 1) {
            const gradeSrc = imgs[0].getAttribute('src');
            if (gradeSrc.includes('/E.png')) {
                return 0;
            }
        }

        return 1;
    };

    // ランキング対象の譜面種別を取得する
    function getDifficultyFromText(diffText) {
        if (diffText.includes('鬼') || diffText.includes('Challenge')) {
            return 'CHALLENGE';
        } else if (diffText.includes('激') || diffText.includes('Expert')) {
            return 'EXPERT';
        } else if (diffText.includes('踊') || diffText.includes('Difficult')) {
            return 'DIFFICULT';
        } else if (diffText.includes('楽') || diffText.includes('Basic')) {
            return 'BASIC';
        } else if (diffText.includes('習') || diffText.includes('Beginner')) {
            return 'BEGINNER';
        } else {
            return '?';
        }
    }

    // 統計パネルを削除し、集計用の配列をクリアする
    function deleteResultPanel() {
        const panel = document.getElementById('ranking-stats-parent');
        if (panel !== null) {
            panel.remove();
        }
        allScores.splice(0);
        allLamps.splice(0);
        seenRanks.clear();
        seenPlayerNames.clear();
    }

    // 統計パネルを作って表示する
    function showResultPanel() {
        const { scoreTotal, scoreResults } = calculateScoreStats();
        const { lampTotal, lampResults } = calculateLampStats();

        // 言語を判定
        const langImg = document.querySelector('.div-footer-lang img');
        const langIsJp = langImg.src.includes('jp');

        // SINGLEかDOUBLEかを判定
        const spdpButton = document.getElementById('spdp-btn');
        const spdpSrc = spdpButton.getAttribute('src');
        const spdpText = spdpSrc.includes('doubles') ? 'DOUBLE' : 'SINGLE';

        // 譜面難度を取得
        const diffHeader = document.querySelector('.td-ranking-header-left .h1-rankings');
        const diffText = getDifficultyFromText(diffHeader.textContent);
        
        // 統計パネルの親を作る
        const panelParent = document.createElement('div');
        panelParent.className = 'ranking-stats-parent';
        panelParent.id = 'ranking-stats-parent';

        // 統計パネルを作る
        const panel = document.createElement('div');
        panel.className = 'ranking-stats';
        panelParent.appendChild(panel);

        // 統計パネルのタイトルを作る
        const title = document.createElement('div');
        if (langIsJp) {
            title.textContent = `${spdpText} ${diffText} ランキング統計（総数: ${formatNumber(scoreTotal)}）`;
        } else {
            title.textContent = `${spdpText} ${diffText} Ranking Stats (Total: ${formatNumber(scoreTotal)})`;
        }
        title.classList.add('ranking-title');
        if (diffText === 'BEGINNER') {
            title.classList.add('sakamoto-difficulty-beginner');
        } else if (diffText === 'BASIC') {
            title.classList.add('sakamoto-difficulty-basic');
        } else if (diffText === 'DIFFICULT') {
            title.classList.add('sakamoto-difficulty-difficult');
        } else if (diffText === 'EXPERT') {
            title.classList.add('sakamoto-difficulty-expert');
        } else if (diffText === 'CHALLENGE') {
            title.classList.add('sakamoto-difficulty-challenge');
        }
        panel.appendChild(title);

        // 左テーブルと右テーブルの親をフレックスとして作る
        const flexParent = document.createElement('div');
        flexParent.classList.add('ranking-tables');
        panel.appendChild(flexParent);

        // 左右のテーブルを作る
        const lampTable = document.createElement('table');
        flexParent.appendChild(lampTable);

        const scoreTable = document.createElement('table');
        flexParent.appendChild(scoreTable);

        const lampTBody = document.createElement('tbody');
        lampTable.appendChild(lampTBody);

        const scoreTBody = document.createElement('tbody');
        scoreTable.appendChild(scoreTBody);
        
        // 左テーブルの各行を作る
        lampResults.forEach(r => {
            const row = document.createElement('tr');
            const nameColumn = document.createElement('td');
            const countColumn = document.createElement('td');
            const ratioColumn = document.createElement('td');
            nameColumn.classList.add('ranking-grade');
            nameColumn.classList.add(r.threshold.className);
            nameColumn.textContent = r.threshold.lampName;
            countColumn.textContent = `${formatNumber(r.count)}/${formatNumber(lampTotal)}`;
            ratioColumn.textContent = `(${r.ratio}%)`;
            lampTBody.appendChild(row);
            row.appendChild(nameColumn);
            row.appendChild(countColumn);
            row.appendChild(ratioColumn);
        });

        // 右テーブルの各行を作る
        scoreResults.forEach(r => {
            const row = document.createElement('tr');
            const nameColumn = document.createElement('td');
            const countColumn = document.createElement('td');
            const ratioColumn = document.createElement('td');      
            nameColumn.classList.add('ranking-grade');      
            nameColumn.classList.add(r.threshold.className);
            nameColumn.textContent = r.threshold.scoreName;
            countColumn.textContent = `${formatNumber(r.count)}/${formatNumber(scoreTotal)}`;
            ratioColumn.textContent = `(${r.ratio}%)`;
            scoreTBody.appendChild(row);
            row.appendChild(nameColumn);
            row.appendChild(countColumn);
            row.appendChild(ratioColumn);
        });

        // 統計パネルの親をドキュメントに挿入する
        const insertPosition = document.querySelector('#main .tbl-ranking-header');
        insertPosition.before(panelParent);
    }

    async function main() {
        const ok = await waitForRealRanking();
        if (!ok) {
            console.error("ランキング読み込み失敗");
            return;
        }

        await collectAllPagesInBackground();
        showResultPanel();

        const setupDiffButtonObserver = () => {
            const buttons = document.querySelectorAll('[id^="diff-"]');

            buttons.forEach(btn => {
                if (btn.dataset.analysisHooked) return;
                btn.dataset.analysisHooked = "1";

                btn.addEventListener('click', async () => {
                    deleteResultPanel();
                    const changeDiffOk = await waitForRealRanking();
                    if (changeDiffOk) {
                        await collectAllPagesInBackground();
                        showResultPanel();
                    } else {
                        console.error("ランキング読み込み失敗");
                    }
                });
            });
        };

        // 難易度ボタン監視を常駐
        setupDiffButtonObserver();

    }

    main();
})();
