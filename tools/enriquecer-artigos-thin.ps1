$ErrorActionPreference = 'Stop'

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$jsonPath = Join-Path $projectRoot 'data/noticias.json'

if (-not (Test-Path $jsonPath)) {
    throw "Ficheiro nao encontrado: $jsonPath"
}

$data = Get-Content -Path $jsonPath -Raw -Encoding UTF8 | ConvertFrom-Json

$appendBySlug = @{
    'vodafone-perde-a-cabeca-e-aposta-tudo' = @'
<p><strong>Porque e que isto interessa para alem da campanha?</strong></p><p>Porque mostra que a Vodafone ja nao consegue viver apenas do argumento da marca premium sem colocar um incentivo economico em cima da mesa. O mercado mudou, os clientes comparam mais e a pressao low-cost obrigou as operadoras historicas a darem sinais concretos de resposta. Esta campanha nao resolve tudo, mas confirma que o conforto acabou.</p><p>Tambem e importante perceber que este tipo de promocao permite a Vodafone defender margem sem baixar logo o preco base de toda a oferta. Em vez de assumir um corte estrutural para todos, prefere usar descontos condicionados, temporarios e com angariacao. Isso protege receita no curto prazo, mas tambem revela prudencia: a operadora quer reagir sem admitir totalmente uma guerra frontal de precos na marca principal.</p><p>Fontes consultadas: pagina oficial da campanha Vodafone Member Get Member, informacao comercial publica da Vodafone Portugal e contexto concorrencial recente do mercado portugues das telecomunicacoes.</p>
'@
    'digi-responde-a-amigo-uzo-e-woo-na-luta-de-precos' = @'
<p><strong>O que esta realmente em jogo nesta resposta da DIGI?</strong></p><p>Mais do que alguns gigas extra ou menos alguns euros, o que esta em jogo e a narrativa do mercado. As marcas brancas das operadoras incumbentes tentaram travar a fuga de clientes com uma resposta rapida, mas a DIGI mostrou que continua disposta a mexer primeiro e a empurrar os outros para tras. Isso e relevante porque mantem a pressao competitiva e impede que a acomodacao volte demasiado cedo.</p><p>Ao mesmo tempo, convem nao olhar para estas mexidas como se fossem o fim da historia. Tarifarios mais agressivos ajudam a captar atencao, mas a fidelizacao real so aparece quando a operadora consegue combinar preco com experiencia de rede, estabilidade e confianca. E aqui que a DIGI continua a ser testada: nao basta ser a mais barata, tem de provar que consegue sustentar essa vantagem sem degradar a percecao do servico.</p><p>Fontes consultadas: comunicacao comercial publica da DIGI Portugal, ofertas moveis das marcas Amigo, UZO e WOO e acompanhamento editorial do mercado movel em Portugal.</p>
'@
    'digi-com-novidades-na-rede-movel-hd-voice' = @'
<p><strong>Porque e que o HD Voice+ merece atencao?</strong></p><p>Porque qualidade de chamada tambem conta para a percecao da rede, mesmo numa altura em que quase toda a conversa do mercado anda focada em gigas e velocidade. Quando uma operadora melhora a experiencia de voz em VoLTE e 5G, esta a atuar num detalhe que o utilizador pode nao saber explicar tecnicamente, mas nota no uso real. E isso pesa mais do que parece na imagem global do servico.</p><p>Ainda assim, convem nao exagerar a leitura. O HD Voice+ e uma melhoria positiva, mas nao apaga sozinho as duvidas sobre cobertura, consistencia e maturidade da rede em diferentes zonas do pais. A grande questao continua a ser esta: a DIGI esta apenas a somar pequenos avancos tecnicos ou esta realmente a consolidar uma rede mais estavel e previsivel para o utilizador comum?</p><p>Fontes consultadas: observacoes tecnicas partilhadas publicamente por analistas do setor, informacao sobre VoLTE e HD Voice e acompanhamento editorial da evolucao da rede movel da DIGI em Portugal.</p>
'@
    'marcas-brancas-ja-responderam-ao-ataque-da-digi' = @'
<p><strong>Esta resposta das marcas brancas chega para travar a DIGI?</strong></p><p>Na minha leitura, chega para ganhar tempo, mas nao necessariamente para fechar o tema. Amigo, UZO e WOO perceberam que nao podiam ficar quietas a ver a DIGI empurrar o mercado para baixo. O problema e que responder com ajustes taticos nao e o mesmo que assumir uma mudanca estrutural. E isso o consumidor tambem percebe.</p><p>Se a DIGI continuar a usar o preco como arma principal, as marcas brancas vao ser obrigadas a escolher entre duas estrategias desconfortaveis: aceitar margens menores ou diferenciar-se melhor em cobertura, apoio e oferta complementar. Ate agora, a primeira reacao serviu para travar o choque imediato. O teste serio sera perceber quem consegue manter esta luta sem parecer que esta apenas a remendar o tarifario do mes.</p><p>Fontes consultadas: paginas oficiais das ofertas Amigo, UZO, WOO e DIGI, comunicacao comercial publica das operadoras e monitorizacao editorial da guerra de precos no segmento movel.</p>
'@
    'digi-pede-alteracao-na-faixa-3-6ghz-a-anacom' = @'
<p><strong>Porque e que esta reorganizacao de espectro importa?</strong></p><p>Porque o tema do espectro parece tecnico e distante, mas tem impacto direto na forma como a rede pode ser montada e otimizada. Quando uma operadora consegue blocos mais contiguos, ganha eficiencia, simplifica desenho de rede e aumenta potencial de desempenho. Nao e apenas uma formalidade administrativa: e uma base importante para melhorar capacidade e consistencia no 5G.</p><p>Ao mesmo tempo, este tipo de decisao nao deve ser lido como vitoria automatica no terreno. Ter melhor organizacao de espectro ajuda, mas o resultado final continua dependente de investimento, rollout e capacidade operacional. Em resumo: a ANACOM abriu uma porta util para a DIGI, mas agora a operadora e que tem de mostrar que consegue transformar essa vantagem regulatoria em melhoria real para os clientes.</p><p>Fontes consultadas: informacao publica da ANACOM sobre a faixa dos 3,6 GHz, enquadramento regulatorio do espectro e acompanhamento editorial da implementacao 5G em Portugal.</p>
'@
    'digi-avanca-para-o-reino-unido' = @'
<p><strong>O que nos diz esta expansao para o Reino Unido?</strong></p><p>Diz-nos que a DIGI continua a pensar como grupo em crescimento e nao apenas como operador focado num unico mercado. Isso interessa a quem acompanha Portugal porque ajuda a perceber a ambicao da empresa e a forma como reparte capital, prioridades e foco de execucao. Uma operacao internacional pode ser sinal de forca, mas tambem levanta a pergunta certa: ate que ponto a empresa consegue expandir sem dispersar atencao nos mercados onde ainda tem muito por consolidar?</p><p>Para o caso portugues, a leitura nao e automaticamente negativa nem positiva. Por um lado, uma DIGI maior pode ganhar escala e experiencia. Por outro, o consumidor portugues vai continuar a julgar a empresa pelo que acontece ca: cobertura, estabilidade, resposta a problemas e capacidade de cumprir o que promete. A expansao para o Reino Unido pode impressionar no papel, mas a credibilidade continua a ser ganha no terreno.</p><p>Fontes consultadas: informacao corporativa publica do Grupo DIGI, noticias sobre expansao internacional e acompanhamento editorial da operacao da DIGI em Portugal.</p>
'@
    'nova-proposta-da-meo-compensa-para-ti-sabe-tudo' = @'
<p><strong>Vale mesmo a pena esta aposta da MEO Energia?</strong></p><p>Depende menos do brilho da campanha e mais do perfil do cliente. A MEO tenta usar a energia como ferramenta de fidelizacao e de reforco do ecossistema da marca, o que faz sentido do ponto de vista comercial. O discurso das vantagens adicionais, dos dados moveis e da acumulacao de beneficios pode parecer forte, mas o consumidor so ganha realmente se o pacote final fizer sentido no custo total e nao apenas na publicidade.</p><p>E aqui esta o ponto que nao deve ser ignorado: ofertas convergentes podem parecer mais completas, mas tambem aumentam dependencia da mesma marca. Quando telecom e energia ficam juntos, a operadora ganha mais capacidade para reter o cliente e tornar a saida menos simples. Por isso, antes de olhar para a campanha como grande oportunidade, convem comparar bem a fatura final e perceber se existe ganho real ou apenas mais uma camada de fidelizacao embalada como beneficio.</p><p>Fontes consultadas: comunicacao publica da MEO Energia, informacao comercial da MEO sobre pacotes elegiveis e acompanhamento editorial da convergencia entre telecom e energia em Portugal.</p>
'@
    'meo-nos-e-vodafone-acusadas-de-cartel' = @'
<p><strong>Porque e que este caso tem peso no mercado?</strong></p><p>Porque acusacoes desta natureza nao sao apenas ruido mediatico. Quando a Autoridade da Concorrencia aponta para praticas concertadas entre os principais operadores, o tema deixa de ser uma simples discussao entre marcas e passa a tocar no centro do problema do mercado portugues: precos historicamente elevados, pouca agressividade competitiva durante anos e uma sensacao persistente de que o consumidor esteve demasiado tempo sem alternativas reais.</p><p>Ao mesmo tempo, tambem e preciso manter rigor na leitura. Uma acusacao nao equivale a condenacao final e o processo tem o seu caminho proprio. Ainda assim, o caso reforca algo que muitos consumidores ja sentiam intuitivamente: houve um longo periodo em que o mercado pareceu fechado sobre si mesmo. E exatamente por isso que a entrada de novos operadores e a pressao low-cost tiveram tanto impacto na percecao publica.</p><p>Fontes consultadas: comunicacao publica da Autoridade da Concorrencia, enquadramento noticioso sobre o processo e acompanhamento editorial da evolucao concorrencial nas telecomunicacoes em Portugal.</p>
'@
    'digi-no-metro-de-lisboa-uma-novela-antiga' = @'
<p><strong>Porque e que o Metro de Lisboa pesa tanto na imagem da DIGI?</strong></p><p>Porque nao estamos a falar de um detalhe irrelevante. O metro e um dos locais onde muitos utilizadores testam a operadora todos os dias, de forma repetida e exigente. Quando a experiencia falha num sitio tao simbolico e tao usado, a percecao negativa espalha-se depressa. E por isso que este tema se arrasta como novela: nao e apenas tecnico, e reputacional.</p><p>Se a DIGI conseguir fechar finalmente este dossie com uma cobertura funcional e estavel, ganha mais do que um ponto no mapa. Ganha credibilidade junto de pessoas que querem sinais concretos de maturidade da rede. Se nao conseguir, a historia continua a servir como argumento facil para quem ainda olha para a operadora como um projeto incompleto. Em resumo: resolver o metro nao e tudo, mas e um simbolo importante de maturidade operacional.</p><p>Fontes consultadas: informacao publica sobre cobertura no Metro de Lisboa, observacoes partilhadas por utilizadores e acompanhamento editorial da rede movel da DIGI em Portugal.</p>
'@
}

$updated = $false

foreach ($noticia in $data.noticias) {
    $slug = [string]$noticia.slug
    if (-not $appendBySlug.ContainsKey($slug)) {
        continue
    }

    $appendHtml = [string]$appendBySlug[$slug]
    if ([string]::IsNullOrWhiteSpace($appendHtml)) {
        continue
    }

    $currentContent = [string]$noticia.conteudo
    $marker = ([regex]::Match($appendHtml, 'Fontes consultadas:[^<]+')).Value
    if (-not [string]::IsNullOrWhiteSpace($marker) -and $currentContent -like "*$marker*") {
        continue
    }

    $currentContent = $currentContent -replace '<p><br></p>\s*$', ''
    $noticia.conteudo = ($currentContent + $appendHtml)
    $updated = $true
}

if (-not $updated) {
    Write-Output 'Sem alteracoes: os artigos alvo ja continham os blocos de reforco.'
    exit 0
}

$json = $data | ConvertTo-Json -Depth 100
[System.IO.File]::WriteAllText($jsonPath, $json, [System.Text.UTF8Encoding]::new($false))

Write-Output 'Artigos thin reforcados no data/noticias.json'