// Guarda qual porta o jogador escolheu:
// "estagio" ou "junior"
let mode = "";

// Procura o elemento HTML do personagem
const player = document.getElementById("player");

// ========================================
// ESTADO DO CONTROLE DO JOGADOR
// ========================================
const GROUND_BOTTOM = 203;  // altura do chão (mesma da plataforma)
const JUMP_HEIGHT = 40;     // o quanto o player sobe no pulo
const JUMP_LIMIT = 500;     // depois desse X, se não pulou, cai
const HOLE_BOTTOM = 80;     // até onde o player desce ao cair no buraco

let pos = 240;          // posição X atual do player
let frame = 0;           // frame atual da animação de corrida
let movingRight = false; // seta direita está pressionada?
let jumped = false;      // já pulou (ou caiu) nesta rodada?
let gameActive = false;  // o jogo está em andamento?
let runLoop = null;      // referência do intervalo de corrida


// ========================================
// ESCALA DO PALCO (RESPONSIVIDADE)
// ========================================
// Toda a física do jogo (walk/jump/fall) usa posições em pixel
// dentro de uma resolução virtual fixa. Aqui só escalamos o
// palco inteiro para caber na tela, sem mexer nessa lógica.
const stage = document.getElementById("stage");
const STAGE_WIDTH = 1280;
const STAGE_HEIGHT = 720;

// Faixa horizontal que realmente importa pro jogo (do início do
// chão até o troféu). Em telas estreitas (celular em pé), usamos
// essa faixa como referência pra dar mais zoom em vez de encolher
// o palco inteiro de 1280px de largura, que deixaria tudo minúsculo.
const CONTENT_WIDTH = 800;

function resizeStage(){

    // Encolhe o palco inteiro pra caber (comportamento original)
    const fitScale = Math.min(
        window.innerWidth / STAGE_WIDTH,
        window.innerHeight / STAGE_HEIGHT
    );

    // Dá mais zoom usando só a faixa de conteúdo relevante,
    // cortando as bordas decorativas nas laterais
    const fillScale = Math.min(
        window.innerWidth / CONTENT_WIDTH,
        window.innerHeight / STAGE_HEIGHT
    );

    // Usa sempre o maior dos dois (nunca fica menor que antes)
    const scale = Math.max(fitScale, fillScale);

    const offsetX = (window.innerWidth - STAGE_WIDTH * scale) / 2;
    const offsetY = (window.innerHeight - STAGE_HEIGHT * scale) / 2;

    stage.style.transform =
        `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
}

window.addEventListener("resize", resizeStage);
resizeStage();


// ========================================
// ESCALA DO PALCO DO MENU (moto, personagem e portas)
// ========================================
// Mesma técnica do #stage: xl125, player-preview e .doors
// são posicionados em pixel fixo dentro de um palco do
// tamanho real de cenario.png (1774x887). O fator de escala
// faz esse palco cobrir a tela (como um background-size:cover),
// sempre ancorado embaixo e centralizado, então o "chão" nunca
// desalinha entre telas.
const scenario = document.getElementById("scenario");
const SCENARIO_WIDTH = 1774;
const SCENARIO_HEIGHT = 887;

// Faixa horizontal onde moto + personagem + portas ficam
// (ver style.css: vai de x=434 até x=1339, ou seja 905px).
// Usada como teto pro zoom em telas estreitas (celular em pé).
// Fica bem folgada (1150 > 905) de propósito, como margem de
// segurança pra moto e portas nunca saírem cortadas da tela.
const SCENARIO_CONTENT_WIDTH = 1150;

function resizeScenario(){

    if(!scenario) return;

    const coverScale = Math.max(
        window.innerWidth / SCENARIO_WIDTH,
        window.innerHeight / SCENARIO_HEIGHT
    );

    const contentFitScale = window.innerWidth / SCENARIO_CONTENT_WIDTH;

    const scale = Math.min(coverScale, contentFitScale);

    scenario.style.transform = `translateX(-50%) scale(${scale})`;
}

window.addEventListener("resize", resizeScenario);
resizeScenario();

// Fecha tutorial ao clicar/tocar (para mobile)
document.getElementById("tutorial").addEventListener("click", () => {
    document.getElementById("tutorial").style.display = "none";
    gameActive = true;
    startRunLoop();
});

// Botão "Pular" - tratal tutorial e pulo
function handleJumpBtnClick(){
    // Se tutorial está aberto, fecha
    const tutorial = document.getElementById("tutorial");
    if(tutorial.style.display !== "none" && tutorial.style.display !== ""){
        tutorial.style.display = "none";
        gameActive = true;
        startRunLoop();
        return;
    }

    tryJump();
}


// ========================================
// CONTROLES DO JOGADOR (seta direita + pulo)
// ========================================
window.addEventListener("keydown", (e) => {

    // Se tutorial está aberto, fecha ao pressionar qualquer tecla
    const tutorial = document.getElementById("tutorial");
    if(tutorial.style.display !== "none" && tutorial.style.display !== ""){
        tutorial.style.display = "none";
        gameActive = true;
        startRunLoop();
        return;
    }

    if(!gameActive) return;

    if(e.code === "ArrowRight"){
        movingRight = true;
    }

    if(e.code === "Space" || e.code === "ArrowUp"){
        e.preventDefault();
        tryJump();
    }
});

window.addEventListener("keyup", (e) => {

    if(e.code === "ArrowRight"){
        movingRight = false;
    }
});

// Botão "Correr" (um clique já deixa correndo até pular ou cair)
const runBtn = document.getElementById("runBtn");

runBtn.addEventListener("click", () => {
    // Se tutorial está aberto, fecha
    const tutorial = document.getElementById("tutorial");
    if(tutorial.style.display !== "none" && tutorial.style.display !== ""){
        tutorial.style.display = "none";
        gameActive = true;
        startRunLoop();
        return;
    }

    if(!gameActive) return;
    if(jumped) return;
    movingRight = true;
});

// Frames da animação de caminhada
const walkFrames = [
  "assets/walk_1.png",
  "assets/walk_2.png",
  "assets/walk_3.png",
  "assets/walk_4.png",
  "assets/walk_5.png",
  "assets/walk_6.png"
];

// Frames da animação de pulo
const jumpFrames = [
  "assets/jump_1.png",
  "assets/jump_2.png"
];

// Frames da animação de queda
const fallFrames = [
  "assets/fall_1.png",
  "assets/fall_2.png"
];


// ========================================
// INICIA O JOGO
// ========================================
function startGame(selected){

    // Guarda qual porta foi escolhida
    mode = selected;

    // Esconde o menu inicial
    document.getElementById("menu").style.display = "none";

    // Mostra a tela do jogo
    document.getElementById("game").style.display = "block";

    // Mostra tutorial
    document.getElementById("tutorial").style.display = "flex";

    // Reseta o estado do controle
    clearInterval(runLoop);
    pos = 240;
    frame = 0;
    movingRight = false;
    jumped = false;
    gameActive = false; // Não ativa até fechar tutorial

    // Posição inicial do personagem
    player.src = "assets/idle_1.png";
    player.className = "";
    player.style.left = pos + "px";
    player.style.bottom = GROUND_BOTTOM + "px";

    // Mostra bandeira e recompensa de acordo com a porta escolhida
    const flag = document.getElementById("flag");
    const reward = document.getElementById("reward");

    if(mode === "estagio"){
        flag.src = "assets/flag_green.png";
        reward.src = "assets/recompensa_estagio.png";
    }else{
        flag.src = "assets/flag_blue.png";
        reward.src = "assets/recompensa_junior.png";
    }

    flag.style.display = "block";
    reward.style.display = "block";
}


// ========================================
// CORRIDA DO PERSONAGEM (controlada pela seta direita)
// ========================================
function startRunLoop(){

    // Executa a cada 100ms
    runLoop = setInterval(() => {

        // Já pulou/caiu? Para de mexer no player
        if(jumped) return;

        // Seta direita não está pressionada? Fica parado
        if(!movingRight) return;

        // Troca sprite
        player.className = "walking";
        player.src = walkFrames[frame];

        // Próximo frame
        frame = (frame + 1) % walkFrames.length;

        // Move personagem para direita
        pos += 6;

        player.style.left = pos + "px";

        // Passou do limite permitido sem pular?
        if(pos >= JUMP_LIMIT){

            clearInterval(runLoop);

            // Caiu direto, sem pular
            missedJump();
        }

    }, 100);
}


// ========================================
// TENTATIVA DE PULO (botão / barra de espaço)
// ========================================
function tryJump(){

    if(!gameActive) return;

    // Já está pulando/caindo ou já passou do limite? Ignora
    if(jumped) return;
    if(pos >= JUMP_LIMIT) return;

    // Lembra se estava correndo, pra continuar depois do pulo
    const wasMoving = movingRight;

    jumped = true;
    movingRight = false;

    jump(pos, wasMoving);
}


// ========================================
// NÃO PULOU A TEMPO
// ========================================
function missedJump(){

    jumped = true;

    // Cai reto do chão, sem o arco do pulo
    fall(pos, GROUND_BOTTOM);
}


// ========================================
// PULO (enquanto ainda está na plataforma_esquerda,
// o pulo é seguro: pousa de volta no chão)
// ========================================
function jump(startX, wasMoving){

    // Primeiro frame do pulo
    player.className = "jumping";
    player.src = jumpFrames[0];

    let y = GROUND_BOTTOM;
    let x = startX;
    let rising = true;

    const jumpAnim = setInterval(() => {

        // Anda para frente
        x += 5;

        if(rising){

            // Sobe
            y += 4;

            // Altura máxima atingida
            if(y >= GROUND_BOTTOM + JUMP_HEIGHT){
                rising = false;
            }

        }else{

            // Desce de volta pro chão
            y -= 4;

            // Pousou?
            if(y <= GROUND_BOTTOM){

                clearInterval(jumpAnim);
                land(x, wasMoving);
                return;
            }
        }

        player.style.left = x + "px";
        player.style.bottom = y + "px";

        // Segundo frame do pulo
        player.src = jumpFrames[1];

    }, 30);
}


// ========================================
// POUSO DO PULO
// ========================================
function land(x, wasMoving){

    pos = x;

    // O pulo empurrou o player pra além do limite? Cai de vez
    if(pos >= JUMP_LIMIT){
        missedJump();
        return;
    }

    jumped = false;

    player.style.left = pos + "px";
    player.style.bottom = GROUND_BOTTOM + "px";

    if(wasMoving){

        // Estava correndo: o loop de corrida (que continua ativo
        // em segundo plano) retoma o movimento sozinho
        movingRight = true;
        player.className = "walking";

    }else{

        // Estava parado: volta pro idle
        movingRight = false;
        player.className = "";
        player.src = "assets/idle_1.png";
    }
}


// ========================================
// QUEDA NO BURACO
// ========================================
function fall(x, y){

    player.className = "falling";

    let frame = 0;

    const falling = setInterval(() => {

        // Desce rapidamente
        y -= 10;

        // Continua avançando um pouco
        x += 2;

        player.style.left = x + "px";
        player.style.bottom = y + "px";

        // Alterna frames de queda
        player.src = fallFrames[frame];

        frame++;

        if(frame > 1){
            frame = 0;
        }

        // Chegou no fundo do buraco?
        if(y < HOLE_BOTTOM){

            clearInterval(falling);

            // Mostra o personagem desmaiado no fundo do buraco
            player.className = "rip";
            player.src = "assets/rip.png";
            player.style.left = x + "px";
            player.style.bottom = HOLE_BOTTOM + "px";

            // Espera um pouco antes de mostrar a tela de game over
            setTimeout(gameOver, 1000);
        }

    }, 40);
}


// ========================================
// GAME OVER
// ========================================
function gameOver(){

    // Trava os controles
    gameActive = false;
    clearInterval(runLoop);

    // Mostra tela escura
    document.getElementById("gameOver")
        .style.display = "flex";

    // Escolhe qual painel mostrar
    if(mode === "estagio"){

        document.getElementById("gameOverImage")
            .src = "assets/gameover_estagio.png";

    }else{

        document.getElementById("gameOverImage")
            .src = "assets/gameover_junior.png";
    }

    // Mostra dica aleatória
    const tips = [
        "Dica: Pressione PULAR antes de chegar na ponte!",
        "Dica: Não espere até o último segundo para pular!",
        "Dica: Segure a seta direita e aperte espaço no momento certo!",
        "Dica: O pulo é mais curto do que parece, comece cedo!"
    ];
    const randomTip = tips[Math.floor(Math.random() * tips.length)];
    document.getElementById("gameOverTip").textContent = randomTip;
}


// ========================================
// TENTAR NOVAMENTE
// ========================================
function retry(){

    // Esconde game over
    document.getElementById("gameOver")
        .style.display = "none";

    // Recomeça (mostra tutorial novamente)
    startGame(mode);
}


// ========================================
// VOLTAR AO MENU
// ========================================
function backMenu(){

    // Trava os controles
    gameActive = false;
    clearInterval(runLoop);

    // Esconde game over
    document.getElementById("gameOver")
        .style.display = "none";

    // Esconde tutorial se estiver aberto
    document.getElementById("tutorial").style.display = "none";

    // Esconde tela do jogo
    document.getElementById("game")
        .style.display = "none";

    // Mostra menu inicial
    document.getElementById("menu")
        .style.display = "flex";
}