window.ARQUIVO_CLASSES_CBB = [
  {
    "id": "classe-coracao-de-aco",
    "category": "Classes",
    "title": "Coração de Aço",
    "summary": "Resistência física e absorção de ataques: acumule Têmpera ao sofrer dano e gaste-a para proteger a si ou aliados.",
    "image": "https://media.discordapp.net/attachments/1141172502106746961/1572424484068134922/image.png",
    "tags": "Tanque",
    "cost": "",
    "damage": {
      "kind": "reduction",
      "count": 1,
      "faces": 4,
      "label": "Redução do dano recebido"
    },
    "bars": [
      {
        "id": "tempera",
        "label": "Têmpera",
        "max": 3,
        "initial": 0,
        "reset": "manual",
        "description": "Ganhe 1 ao sofrer dano de um ataque inimigo. Gaste de 1 a 3 marcas conforme o efeito. A regra original não determina reinício automático.",
        "visual": "barra"
      }
    ],
    "content": "## Identidade\nClasse voltada a ser uma grande e grossa esponja de dano.\n\n## Têmpera\nPossui [barra:3/3] de **Têmpera**. Sempre que sofre dano de um ataque inimigo, preenche 1 espaço. Apague os espaços indicados para ativar um efeito.\n\n[barra:1/3] Ao sofrer um ataque, reduza o dano recebido em 1d4.\n\n[barra:2/3] Quando um aliado próximo se tornar alvo de um ataque, interponha-se e receba o golpe em seu lugar. Se sofrer dano, preencha 1 espaço de Têmpera normalmente.\n\n[barra:3/3] Quando um ataque o deixaria incapacitado, continue lutando até o Desfecho da rodada seguinte.\n\nCorpo — −1 passo em uma perícia de Corpo à escolha por ponto.\nMente — +1 passo em Determinação, −1 passo em Destreza por ponto.\nEspírito — −2 passos em Sigilo por ponto.",
    "published": true
  },
  {
    "id": "classe-especialista-hoho",
    "category": "Classes",
    "title": "Especialista em Hohō",
    "summary": "Movimentação e reposicionamento: marque um Rastro e retorne a ele para reagir, atacar ou interceptar.",
    "image": "https://media.discordapp.net/attachments/1141172502106746961/1572427519171502270/image.png",
    "tags": "Combatente, Mobilidade",
    "cost": "",
    "damage": null,
    "bars": [
      {
        "id": "rastro",
        "label": "Rastro ativo",
        "max": 1,
        "initial": 0,
        "reset": "manual",
        "description": "Marque quando deixar um Rastro. Desmarque ao retornar ou quando expirar no início da sua próxima oportunidade de agir. Apenas um Rastro por vez.",
        "visual": "marca"
      }
    ],
    "content": "## Identidade\nClasse voltada à velocidade, reposicionamento e confusão dos adversários. **Substitui o Shunpō racial.**\n\n## Rastro\nPossui [marca:1] de **Rastro**. Sempre que utiliza Hohō para se deslocar, escolha um ponto por onde passou e deixe um Rastro. Até o início da sua próxima oportunidade de agir, pode voltar instantaneamente àquela posição. Apenas um Rastro pode existir por vez; criar outro substitui o anterior, e retornar apaga o Rastro.\n\n[marca:1] **Defesa —** Quando um inimigo declara um ataque contra você, retorne ao Rastro antes da resolução; se estiver fora do alcance, o ataque não o atinge.\n\n[marca:1] **Ataque —** Retorne ao Rastro imediatamente antes de executar um ataque, mudando sua direção.\n\n[marca:1] **Intercepção —** Quando um adversário tenta se afastar, retorne ao Rastro para interceptá-lo, desde que a posição escolhida esteja no trajeto percorrido.\n\n[marca:1] **Fuga —** Quando estiver cercado ou encurralado, retorne ao Rastro para escapar do bloqueio, desde que o caminho até a posição anterior não esteja totalmente obstruído.\n\nCorpo — +1 passo em Destreza por ponto.\nMente — +1 passo em uma perícia de Mente à escolha por ponto.\nEspírito — −1 passo em Determinação e Instinto por ponto.",
    "published": true
  },
  {
    "id": "classe-cacador",
    "category": "Classes",
    "title": "Caçador",
    "summary": "Controle de campo com armadilhas: acumule contadores, instale dispositivos e desencadeie efeitos em área.",
    "image": "https://media.discordapp.net/attachments/1141172502106746961/1572429790101774357/image.png",
    "tags": "Controle",
    "cost": "1 contador por armadilha",
    "damage": null,
    "bars": [
      {
        "id": "armadilhas",
        "label": "Contadores de armadilha",
        "max": 5,
        "initial": 1,
        "reset": "scene",
        "description": "Inicia cada cena com 1. +1 quando uma armadilha é acionada por inimigo; +2 ao abrir mão de atacar para preparar terreno (uma vez por rodada). Gaste 1 ao instalar. O efeito considera o total ANTES do gasto.",
        "visual": "contador"
      }
    ],
    "content": "## Identidade\nClasse especializada em controle de campo, enfraquecimento e dano contínuo. Suas habilidades funcionam em conjunto.\n\n## Emboscada\nPossui [contador:5/5] de **Armadilhas** e começa cada cena com [contador:1/5]. Sempre que uma armadilha for acionada por um inimigo, ganhe 1 contador. Uma vez por rodada, pode abrir mão de atacar para preparar o terreno e ganhar 2 contadores. Gaste 1 contador ao instalar uma armadilha.\n\nOs benefícios de uma armadilha dependem da quantidade de contadores disponíveis **antes** de pagar o custo.\n\n[contador:1/5] A armadilha pode atingir um alvo quando acionada.\n\n[contador:2/5] Pode ser detonada manualmente se você perceber sua posição.\n\n[contador:3/5] Passa a atingir todos os alvos num raio de 8 metros.\n\n[contador:4/5] Ao instalar, pode designar até dois indivíduos que não serão afetados pela detonação.\n\n[contador:5/5] Ao explodir, pode detonar outra armadilha instalada em seu raio, iniciando uma cadeia.\n\nCorpo — −1 passo em Vigor e Fortitude por ponto.\nMente — +1 passo em uma perícia de Mente à escolha por ponto.\nEspírito — +1 passo em uma perícia de Espírito à escolha por ponto.",
    "published": true
  },
  {
    "id": "classe-porta-voz",
    "category": "Classes",
    "title": "Porta-voz",
    "summary": "Liderança e manobras coordenadas: use Auxílio para encadear ações e oferecer bônus ofensivos ou defensivos.",
    "image": "",
    "tags": "Suporte",
    "cost": "1 uso por cena",
    "damage": {
      "kind": "bonus",
      "count": 1,
      "faces": 0,
      "label": "Dado de Afinidade (valor não definido)"
    },
    "bars": [
      {
        "id": "manobra",
        "label": "Manobra coordenada disponível",
        "max": 1,
        "initial": 1,
        "reset": "scene",
        "description": "Uma ativação por cena. Gaste a marca ao ativar Manobrista; a nova cena restaura a marca.",
        "visual": "marca"
      }
    ],
    "content": "## Identidade\nClasse especializada em fortalecer aliados, inspirar confiança e coordenar ações através da liderança.\n\n## Manobrista\nPossui [marca:1] de **Manobra** por cena. Ao utilizar Auxílio, escolha dois aliados com quem tenha pelo menos Afinidade e declare uma manobra coordenada. Auxilie o primeiro normalmente; se tiver sucesso, ele poderá auxiliar o segundo numa ação relacionada à manobra, sem gastar sua ação principal.\n\n[marca:1] **Ofensivo —** Aliados coordenados recebem um dado adicional ao dano-base de seu próximo ataque bem-sucedido, conforme o grau de relação com o Porta-voz. Esse dado não altera o teste de acerto.\n\n[marca:1] **Equilibrado —** Aliados recebem um dado adicional para dano-base ou testes defensivos, válido para a ação atual e a próxima ação elegível de cada aliado. O dado tem −1 passo e seu resultado é reduzido à metade, arredondado para cima, com mínimo 1.\n\n[marca:1] **Defensivo —** Os aliados recebem um dado adicional na próxima defesa contra ataque inimigo. O resultado é somado ao teste defensivo, conforme RT ou RA aplicável à defesa.\n\nCorpo — −1 passo em Instinto por ponto.\nMente — +1 passo em Lábia e em uma perícia de Mente à escolha por ponto.\nEspírito — −1 passo em Integridade por ponto.\n\n> O valor do dado por grau de Afinidade depende das regras de criação de personagem ainda em desenvolvimento.",
    "published": true
  }
];
