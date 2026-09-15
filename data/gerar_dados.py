#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gerador de dados ficticios para o produto "BI Ergonomia" ElevaLife.

Objetivo: povoar as 6 tabelas do modelo (Lista CID, Dias Uteis, Mapa Risco,
Plano Acao, Absenteismo, Compativeis) com dados plausiveis e CONSISTENTES
(mesmas chaves Cliente+Unidade+Setor+Posto+Cargo+Atividade cruzando as
tabelas), para que filtros/relacionamentos funcionem de verdade.

Esta e a CAMADA DE DADOS (mock). Nao contem regras de calculo de negocio
(Status Acao, Taxa de Frequencia, Risco Global pos-acao ja vem calculado
para fins de mock, mas a tela recalcula Status Acao em runtime a partir de
Dt Programada / Dt Conclusao e da data atual, conforme especificado).

Saida: data/mock_data.json
"""
import json
import random
from datetime import date, timedelta

random.seed(42)  # reprodutibilidade

HOJE = date(2026, 9, 15)

# ---------------------------------------------------------------------------
# 1) ESTRUTURA ORGANIZACIONAL (Clientes > Unidades > Setores > Postos/Cargos)
# ---------------------------------------------------------------------------

CLIENTES = [
    {"cliente": "Metalurgica Vale Forte", "unidades": ["Unidade Matriz", "Unidade Norte"]},
    {"cliente": "AgroCampo Alimentos", "unidades": ["Unidade Sul", "Unidade Leste", "Unidade Matriz"]},
    {"cliente": "TransRoda Logistica", "unidades": ["Unidade Matriz", "Unidade Oeste"]},
    {"cliente": "Quimica Cerrado Industrial", "unidades": ["Unidade Matriz", "Unidade Norte", "Unidade Sul"]},
]

# Setores possiveis (pool de 6) e cargos/atividades tipicas por setor
SETORES_POOL = ["Producao", "Manutencao", "Logistica/Expedicao", "Qualidade", "Almoxarifado", "Administrativo"]

POSTOS_FISICOS_POR_SETOR = {
    "Producao": ["Linha de Montagem A", "Linha de Montagem B", "Celula de Injecao"],
    "Manutencao": ["Oficina de Manutencao", "Posto de Manutencao Eletrica"],
    "Logistica/Expedicao": ["Doca de Expedicao", "Corredor de Armazenagem", "Patio de Carga"],
    "Qualidade": ["Bancada de Inspecao", "Laboratorio de Qualidade"],
    "Almoxarifado": ["Almoxarifado Central", "Deposito de Insumos"],
    "Administrativo": ["Escritorio Administrativo"],
}

CARGOS_POR_SETOR = {
    "Producao": [
        ("Operador de Producao I", ["Alimentacao de linha de producao", "Operacao de maquina injetora"]),
        ("Operador de Producao II", ["Inspecao visual de pecas", "Embalagem manual de produto acabado"]),
        ("Auxiliar de Producao", ["Abastecimento de insumos na linha", "Limpeza e organizacao do posto"]),
    ],
    "Manutencao": [
        ("Tecnico de Manutencao Mecanica", ["Manutencao preventiva de equipamentos", "Troca de componentes mecanicos"]),
        ("Tecnico de Manutencao Eletrica", ["Manutencao em painéis eletricos", "Diagnostico de falhas eletricas"]),
        ("Auxiliar de Manutencao", ["Apoio em manutencao corretiva", "Organizacao de ferramentas e pecas"]),
    ],
    "Logistica/Expedicao": [
        ("Auxiliar de Expedicao", ["Separacao de pedidos", "Conferencia e embalagem para envio"]),
        ("Conferente", ["Conferencia de carga e descarga", "Lancamento de notas fiscais"]),
        ("Operador de Empilhadeira", ["Movimentacao de paletes", "Armazenagem em porta-paletes"]),
    ],
    "Qualidade": [
        ("Inspetor de Qualidade", ["Inspecao dimensional de pecas", "Registro de nao conformidades"]),
        ("Analista de Qualidade", ["Analise de indicadores de qualidade", "Auditoria de processo"]),
    ],
    "Almoxarifado": [
        ("Auxiliar de Almoxarifado", ["Recebimento e conferencia de materiais", "Armazenagem manual de itens"]),
        ("Almoxarife", ["Controle de estoque", "Separacao de materiais para producao"]),
    ],
    "Administrativo": [
        ("Assistente Administrativo", ["Digitacao e conferencia de documentos", "Atendimento telefonico"]),
        ("Analista Administrativo", ["Elaboracao de relatorios", "Conciliacao de dados em planilhas"]),
    ],
}

# ---------------------------------------------------------------------------
# 2) LISTA CID
# ---------------------------------------------------------------------------

LISTA_CID = [
    {"Cod CID": "M54.5", "CID": "Dor lombar baixa", "CID Abrev": "Lombalgia"},
    {"Cod CID": "M54.2", "CID": "Cervicalgia", "CID Abrev": "Cervicalgia"},
    {"Cod CID": "M75.1", "CID": "Sindrome do manguito rotador", "CID Abrev": "Manguito Rotador"},
    {"Cod CID": "M77.1", "CID": "Epicondilite lateral", "CID Abrev": "Epicondilite"},
    {"Cod CID": "M65.3", "CID": "Tenossinovite de De Quervain", "CID Abrev": "Tenossinovite"},
    {"Cod CID": "G56.0", "CID": "Sindrome do tunel do carpo", "CID Abrev": "Tunel do Carpo"},
    {"Cod CID": "M17.9", "CID": "Gonartrose nao especificada", "CID Abrev": "Gonartrose"},
    {"Cod CID": "S93.4", "CID": "Entorse de tornozelo", "CID Abrev": "Entorse Tornozelo"},
    {"Cod CID": "M25.5", "CID": "Dor articular", "CID Abrev": "Dor Articular"},
    {"Cod CID": "M51.2", "CID": "Deslocamento de disco intervertebral lombar", "CID Abrev": "Hernia Discal"},
    {"Cod CID": "F43.2", "CID": "Reacao ao estresse grave", "CID Abrev": "Reacao a Estresse"},
    {"Cod CID": "M79.6", "CID": "Dor em membro", "CID Abrev": "Dor em Membro"},
]

# ---------------------------------------------------------------------------
# 3) REGIOES CORPORAIS (para diagrama frente/tras)
# ---------------------------------------------------------------------------

REGIOES_FRENTE = ["Ombro Direito", "Ombro Esquerdo", "Cotovelo Direito", "Cotovelo Esquerdo",
                  "Punho Direito", "Punho Esquerdo", "Mao Direita", "Mao Esquerda",
                  "Pe Direito", "Pe Esquerdo"]
REGIOES_TRAS = ["Cervical", "Dorsal", "Lombar", "Quadril Direito", "Quadril Esquerdo",
                "Joelho Direito", "Joelho Esquerdo", "Tornozelo Direito", "Tornozelo Esquerdo"]
REGIOES_TODAS = REGIOES_FRENTE + REGIOES_TRAS

# Tipos de risco do Mapa de Risco (12 colunas conforme RD)
TIPOS_RISCO = ["Col. Cervical", "Tronco", "Ombros", "Cotovelos", "Punhos", "Maos/Dedos",
               "Joelhos", "Pernas", "Tornozelos", "Pes/Dedos", "Psicossocial/Cognitivo", "Ambiental"]

# Perfil de risco por setor: media/desvio (1-4) por tipo de risco -> gera variabilidade real.
# Baselines mais baixos que antes: o Risco Global agora vem da MEDIA das 12 dimensoes
# (nao do maximo), entao o perfil aqui reflete o nivel tipico esperado por dimensao.
PERFIL_RISCO_SETOR = {
    "Producao":            {"Col. Cervical": 2, "Tronco": 3, "Ombros": 3, "Cotovelos": 2, "Punhos": 3, "Maos/Dedos": 2,
                             "Joelhos": 2, "Pernas": 2, "Tornozelos": 1, "Pes/Dedos": 1, "Psicossocial/Cognitivo": 2, "Ambiental": 2},
    "Manutencao":          {"Col. Cervical": 2, "Tronco": 2, "Ombros": 3, "Cotovelos": 2, "Punhos": 2, "Maos/Dedos": 2,
                             "Joelhos": 1, "Pernas": 1, "Tornozelos": 1, "Pes/Dedos": 1, "Psicossocial/Cognitivo": 1, "Ambiental": 2},
    "Logistica/Expedicao": {"Col. Cervical": 1, "Tronco": 3, "Ombros": 2, "Cotovelos": 1, "Punhos": 1, "Maos/Dedos": 1,
                             "Joelhos": 2, "Pernas": 2, "Tornozelos": 1, "Pes/Dedos": 1, "Psicossocial/Cognitivo": 1, "Ambiental": 1},
    "Qualidade":           {"Col. Cervical": 1, "Tronco": 1, "Ombros": 1, "Cotovelos": 1, "Punhos": 1, "Maos/Dedos": 1,
                             "Joelhos": 1, "Pernas": 1, "Tornozelos": 1, "Pes/Dedos": 1, "Psicossocial/Cognitivo": 2, "Ambiental": 1},
    "Almoxarifado":        {"Col. Cervical": 1, "Tronco": 2, "Ombros": 1, "Cotovelos": 1, "Punhos": 1, "Maos/Dedos": 1,
                             "Joelhos": 1, "Pernas": 1, "Tornozelos": 1, "Pes/Dedos": 1, "Psicossocial/Cognitivo": 1, "Ambiental": 1},
    "Administrativo":      {"Col. Cervical": 2, "Tronco": 1, "Ombros": 1, "Cotovelos": 1, "Punhos": 1, "Maos/Dedos": 1,
                             "Joelhos": 1, "Pernas": 1, "Tornozelos": 1, "Pes/Dedos": 1, "Psicossocial/Cognitivo": 2, "Ambiental": 1},
}

RISCO_NIVEL = {1: "Baixo", 2: "Medio", 3: "Alto", 4: "Muito Alto"}

def sortear_score(base):
    """Sorteia um score 1-4 em torno de um valor base, com variabilidade."""
    v = base + random.choice([-1, 0, 0, 0, 1, 1])
    return max(1, min(4, v))

def nivel_para_regiao(cliente_idx):
    """Pequeno vies por cliente para dar variabilidade entre clientes."""
    return random.choice([0, 0, 1]) if cliente_idx % 2 == 0 else random.choice([-1, 0, 0])

def risco_global_por_media(scores_dict):
    """Classifica o Risco Global pela MEDIA das 12 dimensoes (nao pelo maximo -
    usar o maximo faz uma unica dimensao ruim dominar o posto inteiro, o que
    gera uma distribuicao irreal com quase tudo em 'Muito Alto')."""
    media = sum(scores_dict.values()) / len(scores_dict)
    if media >= 2.7:
        return "Muito Alto"
    if media >= 2.15:
        return "Alto"
    if media >= 1.55:
        return "Medio"
    return "Baixo"

# ---------------------------------------------------------------------------
# 4) MESES DE HISTORICO (18 meses: abr/2025 a set/2026)
# ---------------------------------------------------------------------------

def gerar_meses(qtd=18, fim=HOJE):
    meses = []
    y, m = fim.year, fim.month
    for _ in range(qtd):
        meses.append(f"{y:04d}-{m:02d}")
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    return list(reversed(meses))

MESES = gerar_meses(18, HOJE)

def dias_uteis_no_mes(ano_mes):
    """Aproximacao de dias uteis (seg-sex, sem feriados) para o mes."""
    ano, mes = map(int, ano_mes.split("-"))
    if mes == 12:
        prox = date(ano + 1, 1, 1)
    else:
        prox = date(ano, mes + 1, 1)
    d = date(ano, mes, 1)
    count = 0
    while d < prox:
        if d.weekday() < 5:
            count += 1
        d += timedelta(days=1)
    return count

# ---------------------------------------------------------------------------
# 5) MONTAR MASTER DE POSTOS (chave Cliente+Unidade+Setor+Posto+Cargo+Atividade)
# ---------------------------------------------------------------------------

POSTOS = []  # cada item: dict com Cliente, Unidade, Setor, Posto Trabalho, Cargo, Atividade
pid = 0
for ci, cli in enumerate(CLIENTES):
    cliente = cli["cliente"]
    n_setores = random.randint(4, 6)
    setores_cliente = random.sample(SETORES_POOL, n_setores)
    for unidade in cli["unidades"]:
        for setor in setores_cliente:
            cargos = CARGOS_POR_SETOR[setor]
            n_cargos = random.randint(2, len(cargos))
            for cargo, atividades in random.sample(cargos, n_cargos):
                # posto de trabalho = nome do posto fisico do setor (independente do cargo)
                posto_trabalho = random.choice(POSTOS_FISICOS_POR_SETOR[setor])
                for atividade in atividades:
                    pid += 1
                    POSTOS.append({
                        "_pid": f"P{pid:04d}",
                        "Cliente": cliente,
                        "Unidade": unidade,
                        "Setor": setor,
                        "Posto Trabalho": posto_trabalho,
                        "Cargo": cargo,
                        "Atividade": atividade,
                    })

print(f"Total de postos (Cliente+Unidade+Setor+Posto+Cargo+Atividade): {len(POSTOS)}")

# ---------------------------------------------------------------------------
# 6) DIAS UTEIS (Cliente, Unidade, Setor, Ano/Mes, Qtd Colaboradores, Qtd Dias Uteis)
# ---------------------------------------------------------------------------

DIAS_UTEIS = []
# chave de agregacao Cliente+Unidade+Setor (unica, sem posto/cargo)
combos_cus = sorted(set((p["Cliente"], p["Unidade"], p["Setor"]) for p in POSTOS))
for (cliente, unidade, setor) in combos_cus:
    base_colab = random.randint(18, 65)
    for am in MESES:
        variacao = random.randint(-3, 3)
        qtd_colab = max(5, base_colab + variacao)
        DIAS_UTEIS.append({
            "Cliente": cliente,
            "Unidade": unidade,
            "Setor": setor,
            "Ano/Mes Uteis": am,
            "Qtd Colaboradores": qtd_colab,
            "Qtd Dias Uteis": dias_uteis_no_mes(am),
        })

print(f"Total Dias Uteis: {len(DIAS_UTEIS)}")

# ---------------------------------------------------------------------------
# 7) MAPA RISCO (uma linha por posto, com scores por regiao + Risco Global)
# ---------------------------------------------------------------------------

MAPA_RISCO = []
for i, p in enumerate(POSTOS):
    perfil = PERFIL_RISCO_SETOR[p["Setor"]]
    vies = nivel_para_regiao(i)
    scores = {}
    for tipo in TIPOS_RISCO:
        base = perfil[tipo] + vies
        scores[tipo] = sortear_score(base)
    row = {
        "Cliente": p["Cliente"], "Unidade": p["Unidade"], "Setor": p["Setor"],
        "Posto Trabalho": p["Posto Trabalho"], "Cargo": p["Cargo"], "Atividade": p["Atividade"],
        "Risco Global": risco_global_por_media(scores),
    }
    row.update(scores)
    row["_pid"] = p["_pid"]
    MAPA_RISCO.append(row)

print(f"Total Mapa Risco: {len(MAPA_RISCO)}")

# ---------------------------------------------------------------------------
# 8) PLANO ACAO
# ---------------------------------------------------------------------------

ACOES_RECOMENDADAS = [
    ("Rodizio de atividades entre colaboradores", "Administrativa"),
    ("Pausa ergonomica programada", "Administrativa"),
    ("Ajuste de altura de bancada/posto", "Engenharia"),
    ("Treinamento em postura e manuseio de cargas", "Treinamento"),
    ("Fornecimento de apoio ergonomico (EPI/acessorio)", "EPI"),
    ("Redesenho de layout do posto de trabalho", "Engenharia"),
    ("Aquisicao de equipamento auxiliar de movimentacao", "Engenharia"),
    ("Revisao de metas de producao/ritmo de trabalho", "Administrativa"),
]

RESPONSAVEIS = [
    ("Marcos Vinicius Andrade", "Seguranca do Trabalho"),
    ("Fernanda Lopes Cardoso", "Recursos Humanos"),
    ("Ricardo Bittencourt", "Engenharia de Producao"),
    ("Juliana Prado Nascimento", "SESMT"),
    ("Eduardo Malheiros", "Manutencao"),
]

def email_de(nome, cliente):
    dominio = cliente.lower().replace(" ", "").replace("/", "")[:14]
    partes = nome.lower().split()
    return f"{partes[0]}.{partes[-1]}@{dominio}.com.br"

PLANO_ACAO = []
nr_acao = 0
for row in MAPA_RISCO:
    n_acoes = 0
    if row["Risco Global"] in ("Alto", "Muito Alto"):
        n_acoes = random.choice([1, 1, 2])
    elif row["Risco Global"] == "Medio":
        n_acoes = random.choice([0, 0, 1])
    for _ in range(n_acoes):
        nr_acao += 1
        acao, categoria = random.choice(ACOES_RECOMENDADAS)
        resp_nome, resp_area = random.choice(RESPONSAVEIS)

        # datas: programada em algum ponto entre 8 meses atras e 3 meses a frente de HOJE
        offset_prog = random.randint(-240, 90)
        dt_programada = HOJE + timedelta(days=offset_prog)

        # define aleatoriamente se ja foi concluida, e se sim, se atrasou
        dt_conclusao = None
        situacao = random.choices(
            ["sem_conclusao", "concluida_no_prazo", "concluida_com_atraso"],
            weights=[0.45, 0.35, 0.20]
        )[0]
        if situacao == "concluida_no_prazo" and dt_programada <= HOJE:
            dt_conclusao = dt_programada - timedelta(days=random.randint(0, 5))
        elif situacao == "concluida_com_atraso" and dt_programada <= HOJE:
            dt_conclusao = dt_programada + timedelta(days=random.randint(3, 45))
        elif dt_programada > HOJE and situacao != "sem_conclusao":
            # nao pode estar concluida antes de programada futura; deixa sem conclusao
            dt_conclusao = None

        auditoria = random.choice(["Sim", "Sim", "Nao"])
        # "Risco Global" no Plano Acao = risco ATUAL do posto (mesmo valor do Mapa Risco,
        # pela mesma chave) - usado pelo filtro "Postos Criticos" (Alto/Muito Alto).
        # "Fator Risco pos Acao" = nivel de risco resultante, preenchido SO quando a
        # acao foi concluida (reduz 1 nivel, nao abaixo de Baixo) - campo distinto.
        fator_pos = None
        if dt_conclusao is not None:
            niveis = ["Baixo", "Medio", "Alto", "Muito Alto"]
            idx = niveis.index(row["Risco Global"])
            fator_pos = niveis[max(0, idx - 1)]

        PLANO_ACAO.append({
            "Cliente": row["Cliente"], "Unidade": row["Unidade"], "Setor": row["Setor"],
            "Posto Trabalho": row["Posto Trabalho"], "Cargo": row["Cargo"], "Atividade": row["Atividade"],
            "Acao Recomendada": acao,
            "Gestao Acao": random.choice(["ElevaLife", "Cliente"]),
            "Dt Programada": dt_programada.isoformat() if dt_programada else None,
            "Dt Conclusao": dt_conclusao.isoformat() if dt_conclusao else None,
            "Nr Acao": nr_acao,
            "Categoria Acao": categoria,
            "Responsavel Acao": resp_nome,
            "E-mail Responsavel": email_de(resp_nome, row["Cliente"]),
            "Auditoria Ergonomista": auditoria,
            "Dt Auditoria": (dt_conclusao + timedelta(days=random.randint(2, 20))).isoformat() if (dt_conclusao and auditoria == "Sim") else None,
            "Fator Risco pos Acao": fator_pos,
            "Medida Controle ADM": random.choice(["Sim", "Nao"]),
            "Risco Global": row["Risco Global"],
        })

print(f"Total Plano Acao: {len(PLANO_ACAO)}")

# ---------------------------------------------------------------------------
# 9) ABSENTEISMO
# ---------------------------------------------------------------------------

ABSENTEISMO = []
data_inicio_janela = date(int(MESES[0].split("-")[0]), int(MESES[0].split("-")[1]), 1)
janela_dias = (HOJE - data_inicio_janela).days

for p in POSTOS:
    n_afastamentos = random.choices([0, 1, 2, 3], weights=[0.45, 0.30, 0.17, 0.08])[0]
    for _ in range(n_afastamentos):
        cid = random.choice(LISTA_CID)
        regiao = random.choice(REGIOES_TODAS)
        qtd_dias = random.choice([3, 5, 7, 10, 15, 20, 30, 45, 60, 90])
        dt_afastamento = data_inicio_janela + timedelta(days=random.randint(0, max(1, janela_dias - qtd_dias)))
        dt_retorno = dt_afastamento + timedelta(days=qtd_dias)
        ABSENTEISMO.append({
            "Cliente": p["Cliente"], "Unidade": p["Unidade"], "Setor": p["Setor"],
            "Posto Trabalho": p["Posto Trabalho"], "Cargo": p["Cargo"], "Atividade": p["Atividade"],
            "Cod CID": cid["Cod CID"],
            "Dt Afastamento": dt_afastamento.isoformat(),
            "Qtd Dias": qtd_dias,
            "Regiao Corporal": regiao,
            "Dt Retorno": dt_retorno.isoformat(),
        })

print(f"Total Absenteismo: {len(ABSENTEISMO)}")

# ---------------------------------------------------------------------------
# 10) COMPATIVEIS
# ---------------------------------------------------------------------------

NOMES_M = ["Joao Pedro Silva", "Carlos Eduardo Souza", "Marcelo Henrique Alves", "Rafael Gomes Teixeira",
           "Anderson Luiz Ferreira", "Diego Augusto Ramos", "Bruno Cesar Martins", "Thiago Nunes Barbosa"]
NOMES_F = ["Ana Paula Rodrigues", "Camila Fernandes Costa", "Patricia Regina Lima", "Vanessa Cristina Dias",
           "Simone Aparecida Rocha", "Debora Cristina Pires", "Larissa Mendes Batista", "Priscila Santos Moura"]
MEDICOS = ["Dr. Antonio Carlos Vieira", "Dra. Beatriz Camargo", "Dr. Fabio Le Maestro", "Dra. Renata Xavier"]

QUEIXAS = ["Lombalgia", "Cervicalgia", "Tendinite de punho", "Dor no ombro", "Sindrome do tunel do carpo",
           "Dor no joelho", "Epicondilite"]

COMPATIVEIS = []
matricula = 10000
postos_com_atividade = POSTOS  # todos os postos podem ter Atividade Compativel recomendada

for _ in range(60):
    p = random.choice(postos_com_atividade)
    genero = random.choice(["Masculino", "Feminino"])
    nome = random.choice(NOMES_M if genero == "Masculino" else NOMES_F)
    matricula += random.randint(1, 4)
    idade = random.randint(22, 58)
    tempo_empresa_meses = random.randint(3, 180)

    dt_inicio_restricao = data_inicio_janela + timedelta(days=random.randint(0, janela_dias))
    dur_restricao = random.choice([15, 30, 45, 60, 90, 120])
    dt_fim_restricao = dt_inicio_restricao + timedelta(days=dur_restricao)

    if dt_fim_restricao < HOJE:
        status_restricao = "Encerrada"
    elif dt_inicio_restricao > HOJE:
        status_restricao = "Em Avaliacao"
    else:
        status_restricao = "Ativa"

    atividade_compativel_sim = random.choice([True, True, False])

    COMPATIVEIS.append({
        "Cliente": p["Cliente"], "Unidade": p["Unidade"], "Setor": p["Setor"],
        "Posto Trabalho": p["Posto Trabalho"], "Cargo": p["Cargo"], "Atividade": p["Atividade"],
        "Status Restricao": status_restricao,
        "Matricula": str(matricula),
        "Funcionario": nome,
        "Turno Trabalho": random.choice(["1o Turno", "2o Turno", "3o Turno"]),
        "Genero": genero,
        "Idade": idade,
        "Tempo Empresa (meses)": tempo_empresa_meses,
        "Responsavel Area": random.choice(RESPONSAVEIS)[0],
        "Medico Avaliador": random.choice(MEDICOS),
        "Queixa Principal": random.choice(QUEIXAS),
        "Segmento Corporal": random.choice(REGIOES_TODAS),
        "Restricao Medica": "Restricao para esforco repetitivo/levantamento de peso",
        "Inicio Restricao": dt_inicio_restricao.isoformat(),
        "Fim Restricao": dt_fim_restricao.isoformat(),
        "Historico Restricao": random.choice(["Sim", "Nao"]),
        "Doc Atividade Compativel": random.choice(["Sim", "Nao"]),
        "Retorno Medico": (dt_fim_restricao + timedelta(days=random.randint(0, 10))).isoformat(),
        "Atividade Compativel (recomendada)": p["Atividade"] if atividade_compativel_sim else "Avaliacao pendente de nova atividade",
        "Atividade Compativel": "Sim" if atividade_compativel_sim else "Nao",
    })

print(f"Total Compativeis: {len(COMPATIVEIS)}")

# ---------------------------------------------------------------------------
# 11) SALVAR
# ---------------------------------------------------------------------------

# remove chave interna auxiliar antes de salvar
for row in MAPA_RISCO:
    row.pop("_pid", None)

# Cadastro-mestre (Cliente > Unidade > Setor > {Cargo, Posto de Trabalho >
# Atividade}) - fonte unica de verdade usada pelos selects em cascata dos 4
# cadastros operacionais, agora normalizada em 6 tabelas (uma tela de
# cadastro por entidade, como na aba Cadastro do Cockpit Comercial) em vez
# de uma unica tabela "Hierarquia" com 6 colunas. Cargo e Posto de Trabalho
# sao irmaos dentro do Setor (nao se referenciam entre si - a combinacao dos
# dois so existe de fato nas linhas operacionais); Atividade e filha do
# Posto de Trabalho. O Mapa de Risco ja tem 1 linha por posto de trabalho
# fisico (chave completa), entao cada tabela-mestre e so a projecao unica
# dos campos daquele nivel (mais os campos dos niveis ancestrais).
def _projecao_unica(linhas, campos):
    vistos = set()
    out = []
    for row in linhas:
        chave = tuple(row[c] for c in campos)
        if chave in vistos:
            continue
        vistos.add(chave)
        out.append({c: row[c] for c in campos})
    out.sort(key=lambda r: tuple(r[c] for c in campos))
    return out

CLIENTE_CAD = _projecao_unica(MAPA_RISCO, ["Cliente"])
UNIDADE_CAD = _projecao_unica(MAPA_RISCO, ["Cliente", "Unidade"])
SETOR_CAD = _projecao_unica(MAPA_RISCO, ["Cliente", "Unidade", "Setor"])
CARGO_CAD = _projecao_unica(MAPA_RISCO, ["Cliente", "Unidade", "Setor", "Cargo"])
POSTO_CAD = _projecao_unica(MAPA_RISCO, ["Cliente", "Unidade", "Setor", "Posto Trabalho"])
ATIVIDADE_CAD = _projecao_unica(MAPA_RISCO, ["Cliente", "Unidade", "Setor", "Posto Trabalho", "Atividade"])
print(
    f"Cadastro-mestre: {len(CLIENTE_CAD)} clientes, {len(UNIDADE_CAD)} unidades, "
    f"{len(SETOR_CAD)} setores, {len(CARGO_CAD)} cargos, {len(POSTO_CAD)} postos, "
    f"{len(ATIVIDADE_CAD)} atividades"
)

OUT = {
    "_meta": {
        "gerado_em": HOJE.isoformat(),
        "meses": MESES,
        "clientes": [c["cliente"] for c in CLIENTES],
        "regioes_frente": REGIOES_FRENTE,
        "regioes_tras": REGIOES_TRAS,
        "tipos_risco": TIPOS_RISCO,
    },
    "listaCID": LISTA_CID,
    "diasUteis": DIAS_UTEIS,
    "mapaRisco": MAPA_RISCO,
    "planoAcao": PLANO_ACAO,
    "absenteismo": ABSENTEISMO,
    "compativeis": COMPATIVEIS,
    "cliente": CLIENTE_CAD,
    "unidade": UNIDADE_CAD,
    "setor": SETOR_CAD,
    "cargo": CARGO_CAD,
    "posto": POSTO_CAD,
    "atividade": ATIVIDADE_CAD,
}

with open("data/mock_data.json", "w", encoding="utf-8") as f:
    json.dump(OUT, f, ensure_ascii=False, indent=2)

print("\nArquivo salvo em data/mock_data.json")
print(f"Tamanho de POSTOS (chaves unicas): {len(POSTOS)}")
