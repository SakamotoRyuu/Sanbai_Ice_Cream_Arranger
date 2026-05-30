let filteredScores;
const tableHeaderColumnsUs = ['Song Title', 'Level', 'Clr', 'Flr', 'Score', 'Diff', 'Z-sc', 'Date'];
const tableHeaderColumnsJp = ['曲名', 'ﾚﾍﾞﾙ', 'ｸﾘｱ', 'ﾌﾚｱ', 'スコア', '差分', 'Z値', '日付'];
const sortTypes = ['title', 'level', 'clear', 'flare', 'score', 'difference', 'z-score', 'date'];
const tierMax = 20;
let isDetailsOpened = false;
let langIsJp = false;
let isSortDesc = false;
let previousSortType = '';

function eventHandler() {
    document.removeEventListener("DOMContentLoaded", eventHandler);
    addScoreInfo();
    addScoreTime();
}
  
if (document.readyState !== "loading") {
    // DOM解析が完了している場合は即実行
    addScoreInfo();
    addScoreTime();
} else {
    document.addEventListener("DOMContentLoaded", eventHandler);
}

function isExistScore(song, isDp) {
    // 現在のプレースタイルには存在しないdifficultyの場合は偽
    if ((isDp && song.difficulty < 5 ) || (!isDp && song.difficulty >= 5)) {
        return false;
    }
    // 一曲分を表す要素を取得し、見つからない場合は偽
    const chartElem = document.getElementById('div-jacket-' + song.song_id + '-' + song.difficulty);
    if (chartElem === null) {
        return false;
    }
    return true;
}

function addScoreInfo() {
    const headStr = document.head.textContent;
    
    // 言語判定
    const songTitleElem = document.getElementById('song-title');
    langIsJp = (songTitleElem !== null && songTitleElem.textContent === '曲を選択');

    // scoresオブジェクトの代入式の部分文字列を切り出し、JSON文字列としてパースする
    const scoresPos = headStr.indexOf('let scores');
    if (scoresPos < 0) {
        return;
    }
    const scoreObjStartPos = headStr.indexOf('[', scoresPos + 10);
    if (scoreObjStartPos < 0) {
        return;
    }
    const scoreObjEndPos = headStr.indexOf(']', scoreObjStartPos + 1);
    if (scoreObjEndPos < 0) {
        return;
    }
    const scoreJson = headStr.substring(scoreObjStartPos, scoreObjEndPos + 1);
    const scores = JSON.parse(scoreJson);

    // ダブルプレーならtrue
    const isDp = (window.location.search.indexOf('spdp=1') >= 0);

    // 難易度表に存在するスコアデータをフィルタリング
    filteredScores = scores.filter(song => isExistScore(song, isDp));

    // difficultyListオブジェクトをパース
    const difficultyListPos = headStr.indexOf('let difficultyList');
    if (difficultyListPos < 0) {
        return;
    }
    const difficultyListObjStartPos = headStr.indexOf('{', difficultyListPos + 18);
    if (difficultyListObjStartPos < 0) {
        return;
    }
    const difficultyListObjEndPos = headStr.indexOf('}}', difficultyListObjStartPos + 1);
    if (difficultyListObjEndPos < 0) {
        return;
    }
    const difficultyListJson = headStr.substring(difficultyListObjStartPos, difficultyListObjEndPos + 2);
    const difficultyList = JSON.parse(difficultyListJson);

    // ティアデータの初期化
    const tiers = [];
    for (let i = 0; i < tierMax; i++) {
        const tierContent = new Object();
        tierContent.label = i * 5;
        tierContent.sum = 0;
        tierContent.count = 0;
        tierContent.average = 0.0;
        tierContent.variance = 0.0;
        tierContent.sd = 0.0;
        tiers[i] = tierContent;
    }

    // ティアごとの合計点と件数を集計
    filteredScores.forEach(song => {
        // difficultyListからティアを取得
        const difficultyListKey = song.song_id + '/' + song.difficulty;
        if (difficultyListKey in difficultyList) {
            // 20倍した値をティア番号として使用
            song.tier = Math.round(difficultyList[difficultyListKey].tier * tierMax);
        } else {
            // difficultyListに見つからない場合はtierMaxとする
            song.tier = tierMax;
        }

        if (song.tier >= 0 && song.tier < tierMax) {
            tiers[song.tier].sum += song.score;
            tiers[song.tier].count += 1;
        }
    })

    // ティアごとの平均点を算出
    tiers.forEach(tier => {
        if (tier.count > 0) {
            tier.average = tier.sum / tier.count;
        }
    })

    // ティアごとの分散を算出
    filteredScores.forEach(song => {
        if (song.tier >= 0 && song.tier < tierMax) {
            const diff = song.score - tiers[song.tier].average;
            tiers[song.tier].variance += diff * diff;
        }
    })
    tiers.forEach(tier => {
        tier.variance /= tier.count;
    })

    // ティアごとの標準偏差を算出
    tiers.forEach(tier => {
        tier.sd = Math.sqrt(tier.variance);
    })

    // 各曲の差分と偏差値を算出
    filteredScores.forEach(song => {
        if (song.tier >= 0 && song.tier < tierMax) {
            const average = Math.round(tiers[song.tier].average);
            song.difference = song.score - average;
            if (tiers[song.tier].sd > 0) {
                song.zs = (song.score - tiers[song.tier].average) / tiers[song.tier].sd;
            } else {
                song.zs = 0;
            }
        } else {
            song.difference = 99999999;
            song.zs = 99999999;
        }
    })

    // スコア配列の各要素に処理
    filteredScores.forEach(song => {        
        // ジャケットに被せる情報の親要素
        const textElem = document.createElement('div');
        textElem.className = 'sakamoto-parent';

        // クリアランプ
        if (song.lamp !== 0) {
            const lineLampElem = document.createElement('div');
            lineLampElem.classList.add('sakamoto-lamp');
            setLampText(lineLampElem, song.lamp, song.score);
            textElem.appendChild(lineLampElem);
        }

        // フレア
        if (song.flare > 0) {
            const lineFlareElem = document.createElement('div');
            lineFlareElem.classList.add('sakamoto-flare');
            setFlareText(lineFlareElem, song.flare);
            textElem.appendChild(lineFlareElem);
        }

        // スコア
        const lineScoreElem = document.createElement('div');
        lineScoreElem.className = 'sakamoto-score';
        lineScoreElem.textContent = song.score.toLocaleString();
        textElem.appendChild(lineScoreElem);

        // 差分
        if (song.tier >= 0 && song.tier < tierMax) {
            const lineDifferenceElem = document.createElement('div');
            lineDifferenceElem.classList.add('sakamoto-difference');
            setDifferenceText(lineDifferenceElem, song.difference, song.zs);
            textElem.appendChild(lineDifferenceElem);
        }

        // 最終的に情報をジャケットに被せる
        const chartElem = document.getElementById('div-jacket-' + song.song_id + '-' + song.difficulty);
        if (chartElem !== null) {
            chartElem.appendChild(textElem);
        }

        const jacketImgElem = document.getElementById('jacket-' + song.song_id + '-' + song.difficulty);
        if (jacketImgElem !== null) {
            song.title = jacketImgElem.title;
        }

    });

    // ティアごとの平均スコアの表示
    tiers.forEach(tier => {
        if (tier.count > 0) {
            const tierElem = document.getElementById('label-' + tier.label);
            if (tierElem !== null) {
                const lineAverageElem = document.createElement('div');
                lineAverageElem.classList.add('sakamoto-average');
                lineAverageElem.textContent = Math.round(tier.average).toLocaleString();
                tierElem.parentNode.appendChild(lineAverageElem);
            }
        }
    })

    // スコア詳細テーブルを追加
    const scoreDetailParent = document.createElement('div');

    const details = document.createElement('details');
    details.id = 'sakamoto-details';
    details.classList.add('sakamoto-details');
    scoreDetailParent.appendChild(details);

    const summary = document.createElement('summary');
    summary.textContent = langIsJp ? 'スコア詳細テーブル' : 'Score Details Table';
    details.appendChild(summary);
    const difficultyListContainer = document.getElementById('difficulty-list-container');
    difficultyListContainer.appendChild(scoreDetailParent);

    details.addEventListener("toggle", function () {
        if (!isDetailsOpened && details.open) {
            isDetailsOpened = true;
            addScoreTable('z-score');
        }
    });

}

function setLampText(element, lamp, score) {
    switch (lamp) {
        case 1:
            element.classList.add('sakamoto-clear');
            element.textContent = 'CLEAR';
            break;
        case 2:
            element.classList.add('sakamoto-life4');
            element.textContent = 'LIFE4';
            break;            
        case 3:
            element.classList.add('sakamoto-fc');
            element.textContent = 'FC';
            break;        
        case 4:
            element.classList.add('sakamoto-gfc');
            element.textContent = 'GFC';
            break;
        case 5:
            if (score >= 999910) {
                element.classList.add('sakamoto-sdp');
                element.textContent = 'SDP';
            } else {
                element.classList.add('sakamoto-pfc');
                element.textContent = 'PFC';
            }
            break;
        case 6:
            element.classList.add('sakamoto-mfc');
            element.textContent = 'MFC';
            break;
    }
}

function setFlareText(element, flare) {    
    switch (flare) {
        case 1:
            element.classList.add('sakamoto-f1');
            element.textContent = 'FⅠ';
            break;
        case 2:
            element.classList.add('sakamoto-f2');
            element.textContent = 'FⅡ';
            break;
        case 3:
            element.classList.add('sakamoto-f3');
            element.textContent = 'FⅢ';
            break;
        case 4:
            element.classList.add('sakamoto-f4');
            element.textContent = 'FⅣ';
            break;
        case 5:
            element.classList.add('sakamoto-f5');
            element.textContent = 'FⅤ';
            break;
        case 6:
            element.classList.add('sakamoto-f6');
            element.textContent = 'FⅥ';
            break;
        case 7:
            element.classList.add('sakamoto-f7');
            element.textContent = 'FⅦ';
            break;
        case 8:
            element.classList.add('sakamoto-f8');
            element.textContent = 'FⅧ';
            break;
        case 9:
            element.classList.add('sakamoto-f9');
            element.textContent = 'FⅨ';
            break;
        case 10:
            element.classList.add('sakamoto-fex');
            element.textContent = 'FEX';
            break;
    }
}

function setDifferenceText(element, difference, zs) {
    if (difference === 0) {
        element.textContent = '±0'
    } else if (difference > 0) {
        element.textContent = '+' + difference.toLocaleString();
    } else {
        element.textContent = difference.toLocaleString();
    }
    setZScoreColor(element, zs)
}

function setZScoreColor(element, zs) {
    if (zs > -0.1 && zs < 0.1) {
        element.classList.add('sakamoto-diffEqual');
    } else if (zs > 0) {
        if (zs < 0.5) {
            element.classList.add('sakamoto-diffUp1');
        } else if (zs < 1.0) {
            element.classList.add('sakamoto-diffUp2');
        } else if (zs < 1.5) {
            element.classList.add('sakamoto-diffUp3');
        } else if (zs < 2.0) {
            element.classList.add('sakamoto-diffUp4');
        } else {  
            element.classList.add('sakamoto-diffUp5');
        }
    } else {            
        if (zs > -0.5) {
            element.classList.add('sakamoto-diffDown1');
        } else if (zs > -1.0) {
            element.classList.add('sakamoto-diffDown2');
        } else if (zs > -1.5) {
            element.classList.add('sakamoto-diffDown3');
        } else if (zs > -2.0) {
            element.classList.add('sakamoto-diffDown4');
        } else {  
            element.classList.add('sakamoto-diffDown5');
        }
    }
}

function setDifficultyColor(element, difficulty) {
    switch (difficulty) {
        case 0:
            element.classList.add('sakamoto-difficulty-beginner');
            break;
        case 1:
        case 5:
            element.classList.add('sakamoto-difficulty-basic');
            break;
        case 2:
        case 6:            
            element.classList.add('sakamoto-difficulty-difficult');
            break;
        case 3:
        case 7:            
            element.classList.add('sakamoto-difficulty-expert');
            break;
        case 4:
        case 8:            
            element.classList.add('sakamoto-difficulty-challenge');
            break;            
    }
}

// スコアタイムを追加するメソッド
function addScoreTime() {
    // 対象コンテナを取得
    const container = document.getElementById('song-info-container');

    if (container) {
        // コンテナ内の<a>要素を取得
        const anchor = container.querySelector('a');

        if (anchor) {
            // 変更時に実行したい処理
            const onHrefChanged = (newHref) => {
                const songId = newHref.substring(18, 50);
                const difficulty = Number(newHref.slice(-1));
                let found = false;
                for (const song of filteredScores) {
                    if (song.song_id === songId && song.difficulty === difficulty) {
                        const scoreDateTime = new Date(song.score_time * 1000);
                        let scoreTimeElem = document.getElementById('song-score-time');
                        // スコアタイムの要素がまだ追加されていない場合
                        if (scoreTimeElem === null) {
                            const songInfo = document.getElementById('song-info');
                            scoreTimeElem = document.createElement('p');
                            scoreTimeElem.id = 'song-score-time';
                            scoreTimeElem.classList.add('color-vibrant-dark');
                            scoreTimeElem.textContent = scoreDateTime.toLocaleDateString();
                            songInfo.appendChild(scoreTimeElem);
                        // スコアタイムの要素が既に追加されている場合
                        } else {
                            scoreTimeElem.textContent = scoreDateTime.toLocaleDateString();
                        }
                        found = true;
                        break;
                    }
                }
                // スコアタイムが記録されていない場合はスコアタイム要素を空にする
                if (!found) {
                    let scoreTimeElem = document.getElementById('song-score-time');
                    if (scoreTimeElem !== null) {
                        scoreTimeElem.textContent = '';
                    }
                }
            };

            // MutationObserverの作成
            const observer = new MutationObserver((mutationsList) => {
                for (const mutation of mutationsList) {
                    if (mutation.type === 'attributes' &&  mutation.attributeName === 'href') {
                        const newHref = anchor.getAttribute('href');
                        onHrefChanged(newHref);
                    }
                }
            });

            // 監視開始（href属性のみ監視）
            observer.observe(anchor, {
                attributes: true,
                attributeFilter: ['href']
            });
        }
    }
}

function sortWithTitle() {
    filteredScores.sort(function(a, b) {
        const la = a.title.toLowerCase();
        const lb = b.title.toLowerCase();
        if (la < lb) return -1;
        if (la > lb) return 1;
        if (a.title < b.title) return -1;
        if (a.title > b.title) return 1;
        if (a.tier < b.tier) return -1;
        if (a.tier > b.tier) return 1;
        if (a.lamp < b.lamp) return -1;
        if (a.lamp > b.lamp) return 1;
        if (a.flare < b.flare) return -1;
        if (a.flare > b.flare) return 1;
        if (a.score < b.score) return -1;
        if (a.score > b.score) return 1;
        if (a.difference < b.difference) return -1;
        if (a.difference > b.difference) return 1;
        if (a.zs < b.zs) return -1;
        if (a.zs > b.zs) return 1;
        if (a.score_time < b.score_time) return -1;
        if (a.score_time > b.score_time) return 1;
        return 0;
    })
}

function sortWithTier() {
    filteredScores.sort(function(a, b) {
        if (a.tier < b.tier) return -1;
        if (a.tier > b.tier) return 1;
        if (a.lamp < b.lamp) return -1;
        if (a.lamp > b.lamp) return 1;
        if (a.flare < b.flare) return -1;
        if (a.flare > b.flare) return 1;
        if (a.score < b.score) return -1;
        if (a.score > b.score) return 1;
        if (a.difference < b.difference) return -1;
        if (a.difference > b.difference) return 1;
        if (a.zs < b.zs) return -1;
        if (a.zs > b.zs) return 1;
        if (a.score_time < b.score_time) return -1;
        if (a.score_time > b.score_time) return 1;
        return 0;
    })
}

function sortWithLamp() {
    filteredScores.sort(function(a, b) {
        if (a.lamp < b.lamp) return -1;
        if (a.lamp > b.lamp) return 1;
        if (a.flare < b.flare) return -1;
        if (a.flare > b.flare) return 1;
        if (a.score < b.score) return -1;
        if (a.score > b.score) return 1;
        if (a.difference < b.difference) return -1;
        if (a.difference > b.difference) return 1;
        if (a.zs < b.zs) return -1;
        if (a.zs > b.zs) return 1;
        if (a.score_time < b.score_time) return -1;
        if (a.score_time > b.score_time) return 1;
        if (a.tier < b.tier) return -1;
        if (a.tier > b.tier) return 1;
        return 0;
    })
}

function sortWithFlare() {
    filteredScores.sort(function(a, b) {
        if (a.flare < b.flare) return -1;
        if (a.flare > b.flare) return 1;
        if (a.score < b.score) return -1;
        if (a.score > b.score) return 1;
        if (a.difference < b.difference) return -1;
        if (a.difference > b.difference) return 1;
        if (a.zs < b.zs) return -1;
        if (a.zs > b.zs) return 1;
        if (a.score_time < b.score_time) return -1;
        if (a.score_time > b.score_time) return 1;
        if (a.tier < b.tier) return -1;
        if (a.tier > b.tier) return 1;
        if (a.lamp < b.lamp) return -1;
        if (a.lamp > b.lamp) return 1;
        return 0;
    })
}

function sortWithScore() {
    filteredScores.sort(function(a, b) {
        if (a.score < b.score) return -1;
        if (a.score > b.score) return 1;
        if (a.difference < b.difference) return -1;
        if (a.difference > b.difference) return 1;
        if (a.zs < b.zs) return -1;
        if (a.zs > b.zs) return 1;
        if (a.score_time < b.score_time) return -1;
        if (a.score_time > b.score_time) return 1;
        if (a.tier < b.tier) return -1;
        if (a.tier > b.tier) return 1;
        if (a.lamp < b.lamp) return -1;
        if (a.lamp > b.lamp) return 1;
        if (a.flare < b.flare) return -1;
        if (a.flare > b.flare) return 1;
        return 0;
    })
}

function sortWithDifference() {
    filteredScores.sort(function(a, b) {
        if (a.difference < b.difference) return -1;
        if (a.difference > b.difference) return 1;
        if (a.zs < b.zs) return -1;
        if (a.zs > b.zs) return 1;
        if (a.score_time < b.score_time) return -1;
        if (a.score_time > b.score_time) return 1;
        if (a.tier < b.tier) return -1;
        if (a.tier > b.tier) return 1;
        if (a.lamp < b.lamp) return -1;
        if (a.lamp > b.lamp) return 1;
        if (a.flare < b.flare) return -1;
        if (a.flare > b.flare) return 1;
        if (a.score < b.score) return -1;
        if (a.score > b.score) return 1;
        return 0;
    })
}

function sortWithZScore() {
    filteredScores.sort(function(a, b) {
        if (a.zs < b.zs) return -1;
        if (a.zs > b.zs) return 1;
        if (a.score_time < b.score_time) return -1;
        if (a.score_time > b.score_time) return 1;
        if (a.tier < b.tier) return -1;
        if (a.tier > b.tier) return 1;
        if (a.lamp < b.lamp) return -1;
        if (a.lamp > b.lamp) return 1;
        if (a.flare < b.flare) return -1;
        if (a.flare > b.flare) return 1;
        if (a.score < b.score) return -1;
        if (a.score > b.score) return 1;
        if (a.difference < b.difference) return -1;
        if (a.difference > b.difference) return 1;
        return 0;
    })
}

function sortWithDate() {
    filteredScores.sort(function(a, b) {
        if (a.score_time < b.score_time) return -1;
        if (a.score_time > b.score_time) return 1;
        if (a.tier < b.tier) return -1;
        if (a.tier > b.tier) return 1;
        if (a.lamp < b.lamp) return -1;
        if (a.lamp > b.lamp) return 1;
        if (a.flare < b.flare) return -1;
        if (a.flare > b.flare) return 1;
        if (a.score < b.score) return -1;
        if (a.score > b.score) return 1;
        if (a.difference < b.difference) return -1;
        if (a.difference > b.difference) return 1;
        if (a.zs < b.zs) return -1;
        if (a.zs > b.zs) return 1;
        return 0;
    })
}

// レーティング 曲名、クリア種別、フレア、スコア、差分、Z得点、スコアタイム
// Song Title, 
function addScoreTable(sortType) {
    // 既にスコアテーブルがある場合は削除
    const existingTable = document.getElementById('sakamoto-score-table');
    if (existingTable !== null) {
        existingTable.remove();
    }

    // 引数に対応したソート
    switch (sortType) {
        case 'title':
            sortWithTitle();
            break;
        case 'level':
            sortWithTier();
            break;
        case 'clear':
            sortWithLamp();
            break;
        case 'flare':
            sortWithFlare();
            break;
        case 'score':
            sortWithScore();
            break;
        case 'difference':
            sortWithDifference();
            break;
        case 'z-score':
            sortWithZScore();
            break;
        case 'date':
            sortWithDate();
            break;
    }

    // 前回と同じソートタイプなら逆順にする
    if (sortType === previousSortType && !isSortDesc) {
        filteredScores.reverse();
        isSortDesc = true;
    } else {
        isSortDesc = false;
    }
    previousSortType = sortType;

    // 現在選択中のレベルを取得
    const selectLevelElem = document.getElementById("select-level");
    const optionLevelElem = selectLevelElem.children[selectLevelElem.selectedIndex];
    const level = Number(optionLevelElem.getAttribute('value')); 

    // テーブルを作成
    const table = document.createElement('table');
    table.id = 'sakamoto-score-table';

    // テーブルのヘッダー
    const tableHeader = document.createElement('thead');
    table.appendChild(tableHeader);

    // テーブルのヘッダー行
    const tableHeaderTr = document.createElement('tr');
    tableHeader.appendChild(tableHeaderTr);

    // テーブルのヘッダーの各セルのボタン
    for (let i = 0; i < tableHeaderColumnsUs.length; i++) {
        const tableHeaderTh = document.createElement('th');        
        const button = document.createElement('button');            
        button.textContent = langIsJp ? tableHeaderColumnsJp[i] : tableHeaderColumnsUs[i];
        button.addEventListener('click', {parameter: sortTypes[i], handleEvent: buttonEvent});
        if (sortType === sortTypes[i]) {
            button.classList.add('button-highlight');
        }
        tableHeaderTh.appendChild(button);
        tableHeaderTr.appendChild(tableHeaderTh);
    }

    // テーブルのボディ
    const tableBody = document.createElement('tbody');
    table.appendChild(tableBody);
    
    // テーブルの各行
    filteredScores.forEach(song => {
        const tableBodyTr = document.createElement('tr');
        tableBody.appendChild(tableBodyTr);
        // テーブルの各セル
        for (let i = 0; i < 8; i++) {
            const tableBodyItem = document.createElement('td');
            switch (i) {
                // 曲名
                case 0:
                    tableBodyItem.textContent = song.title;
                    break;
                // レベル
                case 1:
                    setDifficultyColor(tableBodyItem, song.difficulty);
                    if (song.tier >= 0 && song.tier < tierMax) {
                        tableBodyItem.textContent = (level + song.tier * 0.05).toFixed(2);
                    } else {
                        tableBodyItem.textContent = level + '.?';
                    }
                    break;
                // クリア種別
                case 2:
                    setLampText(tableBodyItem, song.lamp);
                    break;
                // フレアランク
                case 3:
                    setFlareText(tableBodyItem, song.flare);
                    break;
                // スコア
                case 4:
                    tableBodyItem.textContent = song.score.toLocaleString();
                    break;
                // ティアごとの平均スコアとの差分
                case 5:
                    if (song.tier >= 0 && song.tier < tierMax) {
                        setDifferenceText(tableBodyItem, song.difference, song.zs);
                    } else {
                        tableBodyItem.textContent = '-';
                    }
                    break;
                // ティア内でのZスコア
                case 6:
                    if (song.tier >= 0 && song.tier < tierMax) {
                        tableBodyItem.textContent = Math.round(song.zs * 100) / 100;
                        setZScoreColor(tableBodyItem, song.zs);
                    } else {
                        tableBodyItem.textContent = '-';
                    }
                    break;
                // スコア登録の日付
                case 7:
                    tableBodyItem.textContent = new Date(song.score_time * 1000).toLocaleDateString();
                    break;
            }
            tableBodyTr.appendChild(tableBodyItem);
        }
    })

    // テーブルを文書本体のディティールに追加
    const details = document.getElementById('sakamoto-details');
    details.appendChild(table);
}

// スコア詳細テーブルのソートボタンを押したときのイベントハンドラ
function buttonEvent(e) {
    addScoreTable(this.parameter);
}

