-- Críticos CBB: apenas a repetição prioritária é duplicada.
-- Prioridade: maior tamanho de dado; em empate, maior resultado repetido.
-- Falha crítica: dois resultados 1 => RT, RA e RB iguais a 1.
-- Preserva as rolagens históricas; só altera avaliações futuras.
CREATE OR REPLACE FUNCTION public.ae_avaliar_dados(p_dice jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $fn$
DECLARE
 v_value integer;v_sides integer;v_die jsonb;v_effective integer;
 v_winner integer;v_priority integer;v_base integer:=0;v_total integer:=0;
 v_ra integer;v_rb integer;v_out jsonb:='[]'::jsonb;v_special text:='';
 v_active boolean;
BEGIN
 IF p_dice IS NULL OR jsonb_typeof(p_dice)<>'array' THEN
  RAISE EXCEPTION 'Lista de dados inválida.';
 END IF;
 SELECT x.value,max(x.sides) INTO v_winner,v_priority
 FROM (
  SELECT (d->>'value')::integer AS value,(d->>'sides')::integer AS sides
  FROM jsonb_array_elements(p_dice) e(d)
  WHERE coalesce((d->>'canceled')::boolean,false)=false
    AND coalesce((d->>'effective')::integer,(d->>'value')::integer,0)<>0
 ) x
 WHERE x.value=1 OR x.value>=6
 GROUP BY x.value HAVING count(*)>=2
 ORDER BY max(x.sides) DESC,x.value DESC LIMIT 1;
 IF v_winner IS NOT NULL THEN
  v_special=CASE WHEN v_winner=1 THEN 'FALHA CRÍTICA' ELSE 'CRÍTICO MÁXIMO' END;
 END IF;
 FOR v_die IN SELECT value FROM jsonb_array_elements(p_dice) LOOP
  v_active=NOT coalesce((v_die->>'canceled')::boolean,false);
  v_value=coalesce((v_die->>'value')::integer,0);
  v_effective=CASE WHEN v_active THEN
   coalesce((v_die->>'effective')::integer,v_value) ELSE 0 END;
  v_base=v_base+v_effective;
  IF v_active AND v_effective<>0 AND v_winner IS NOT NULL
    AND v_value=v_winner AND v_special='CRÍTICO MÁXIMO' THEN
   v_effective=v_effective*2;
   v_die=v_die||jsonb_build_object('effective',v_effective,'criticalApplied',true);
  ELSIF v_active AND v_effective<>0 AND v_winner=1 AND v_value=1 THEN
   v_die=v_die||jsonb_build_object('failureApplied',true);
  END IF;
  v_out=v_out||jsonb_build_array(v_die);
  v_total=v_total+v_effective;
  IF v_active AND v_effective<>0 THEN
   v_ra=greatest(coalesce(v_ra,v_effective),v_effective);
   v_rb=least(coalesce(v_rb,v_effective),v_effective);
  END IF;
 END LOOP;
 IF v_special='FALHA CRÍTICA' THEN v_total=1;v_ra=1;v_rb=1;END IF;
 RETURN jsonb_build_object('base',v_base,'total',v_total,'ra',coalesce(v_ra,0),
   'rb',coalesce(v_rb,0),'special',v_special,'dice',v_out,
   'priorityValue',v_winner,'prioritySides',v_priority);
END;$fn$;

-- Perícias: Fear cancela dados; Hollow modifica apenas os resultados efetivos.
-- Só dados efetivamente ativos podem critar; a ausência de dados NÃO é uma falha crítica.
CREATE OR REPLACE FUNCTION public.ae_transform_test(
 p_dice jsonb,p_fear integer DEFAULT 0,p_hollow boolean DEFAULT false,p_bonus integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $fn$
DECLARE
 v_original jsonb:=coalesce(p_dice,'[]'::jsonb);v_out jsonb:='[]'::jsonb;
 v_die jsonb;v_r integer:=0;v_s integer:=0;v_value integer;v_actual integer;
 v_mode text:='';v_eval jsonb;
 v_cancelled integer:=0;v_broken boolean:=false;v_clear boolean:=false;
 v_advance boolean:=false;v_used boolean:=false;
BEGIN
 IF jsonb_typeof(v_original)<>'array' THEN RAISE EXCEPTION 'Lista de dados inválida';END IF;
 IF p_bonus IN (4,6,8,10,12,20) THEN
  v_original=v_original||jsonb_build_array(jsonb_build_object('sides',p_bonus,
   'value',public.ae_random_die(p_bonus),'bondBonus',true));
  v_used=true;
 END IF;
 IF coalesce(p_hollow,false) THEN
  v_mode='hollow';v_s=6;v_r=public.ae_random_die(v_s);
  v_broken=(v_r=v_s);v_advance=(v_r=1);
 ELSIF coalesce(p_fear,0) IN (4,6,8,10,12,20) THEN
  v_mode='fear';v_s=p_fear;v_r=public.ae_random_die(v_s);v_clear=(v_r=1);
 END IF;
 FOR v_die IN SELECT value FROM jsonb_array_elements(v_original) LOOP
  v_value=(v_die->>'value')::integer;v_actual=v_value;
  IF v_mode='fear' AND v_value<v_r THEN
   v_actual=0;v_cancelled=v_cancelled+1;
  ELSIF v_mode='hollow' AND v_value>v_r THEN
   v_actual=(v_die->>'sides')::integer;
  END IF;
  v_out=v_out||jsonb_build_array(v_die||jsonb_build_object(
   'effective',v_actual,'canceled',v_mode='fear' AND v_value<v_r,
   'maximized',v_mode='hollow' AND v_actual>v_value));
 END LOOP;
 v_eval=public.ae_avaliar_dados(v_out);
 RETURN jsonb_build_object(
  'dice',v_eval->'dice','base',v_eval->'base','total',v_eval->'total',
  'ra',v_eval->'ra','rb',v_eval->'rb','special',v_eval->>'special',
  'usedBonus',v_used,'clearFear',v_clear,'maskBroken',v_broken,
  'hollowAdvance',v_advance,
  'effect',CASE WHEN v_mode='' THEN NULL ELSE jsonb_build_object(
   'mode',v_mode,'sides',v_s,'value',v_r,'canceled',v_cancelled,
   'broken',v_broken,'advance',v_advance,'cleared',v_clear) END);
END;$fn$;

-- Mantém todas as validações e permissões de rolagem livre já existentes.
CREATE OR REPLACE FUNCTION public.ae_roll_custom(
 p_count integer,p_faces integer,p_colors jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_account public.ae_accounts%rowtype;v_dice jsonb:='[]'::jsonb;
 v_colors jsonb:='[]'::jsonb;v_color text;v_eval jsonb;
 v_bytes bytea;v_rand numeric;v_limit numeric;v_value integer;v_i integer;
 v_row public.ae_rolls%rowtype;
BEGIN
 SELECT a.* INTO v_account FROM public.ae_sessions s
 JOIN public.ae_accounts a ON a.id=s.account_id
 JOIN public.ae_keys k ON k.id=s.key_id AND k.active
 WHERE s.user_id=auth.uid() AND k.kind IN ('master','player') LIMIT 1;
 IF v_account.id IS NULL THEN
  RAISE EXCEPTION 'Entre com sua chave para rolar dados verificados.';
 END IF;
 IF p_count IS NULL OR p_faces IS NULL OR p_count NOT BETWEEN 1 AND 30
    OR p_faces NOT BETWEEN 2 AND 1000 THEN
  RAISE EXCEPTION 'Escolha de 1 a 30 dados, com 2 a 1000 faces.';
 END IF;
 v_limit=floor(4294967296::numeric/p_faces)*p_faces;
 FOR v_i IN 1..p_count LOOP
  LOOP
   v_bytes=extensions.gen_random_bytes(4);
   v_rand=get_byte(v_bytes,0)::numeric*16777216+
    get_byte(v_bytes,1)::numeric*65536+get_byte(v_bytes,2)::numeric*256+
    get_byte(v_bytes,3);
   EXIT WHEN v_rand<v_limit;
  END LOOP;
  v_value=(mod(v_rand,p_faces)+1)::integer;
  v_dice=v_dice||jsonb_build_array(jsonb_build_object('sides',p_faces,'value',v_value));
  v_color=CASE WHEN jsonb_typeof(p_colors)='array' AND jsonb_array_length(p_colors)>=v_i
   THEN p_colors->>(v_i-1) ELSE NULL END;
  IF v_color IS NULL OR v_color !~ '^#[0-9a-fA-F]{6}$' THEN v_color='#4CC9F0';END IF;
  v_colors=v_colors||jsonb_build_array(v_color);
 END LOOP;
 v_eval=public.ae_avaliar_dados(v_dice);
 INSERT INTO public.ae_rolls(account_id,account_name,kind,label,dice,total,special,hidden,colors)
 VALUES(v_account.id,v_account.name,'free',p_count::text||'d'||p_faces::text,
  v_eval->'dice',(v_eval->>'total')::integer,v_eval->>'special',false,v_colors)
 RETURNING * INTO v_row;
 RETURN to_jsonb(v_row);
END;$fn$;

CREATE OR REPLACE FUNCTION public.ae_roll_free(
 p_count integer,p_faces integer,p_hidden boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 v_a public.ae_accounts%rowtype;v_key public.ae_keys%rowtype;
 v_dice jsonb:='[]'::jsonb;v_eval jsonb;v_result integer;
 v_row public.ae_rolls%rowtype;v_i integer;
BEGIN
 SELECT a.* INTO v_a FROM public.ae_sessions s
 JOIN public.ae_accounts a ON a.id=s.account_id
 JOIN public.ae_keys k ON k.id=s.key_id AND k.active WHERE s.user_id=auth.uid();
 SELECT k.* INTO v_key FROM public.ae_sessions s JOIN public.ae_keys k
 ON k.id=s.key_id WHERE s.user_id=auth.uid() AND k.active;
 IF v_a.id IS NULL OR v_key.kind NOT IN ('master','player') THEN
  RAISE EXCEPTION 'Faça login antes de rolar online.';
 END IF;
 IF p_hidden AND v_key.kind<>'master' THEN
  RAISE EXCEPTION 'Escudo disponível somente para mestres.';
 END IF;
 IF p_count<1 OR p_count>12 OR p_faces NOT IN (4,6,8,10,12,20) THEN
  RAISE EXCEPTION 'Quantidade ou faces inválidas.';
 END IF;
 FOR v_i IN 1..p_count LOOP
  v_result=public.ae_random_die(p_faces);
  v_dice=v_dice||jsonb_build_array(jsonb_build_object('sides',p_faces,'value',v_result));
 END LOOP;
 v_eval=public.ae_avaliar_dados(v_dice);
 INSERT INTO public.ae_rolls(account_id,account_name,kind,label,dice,total,special,hidden)
 VALUES(v_a.id,v_a.name,CASE WHEN p_hidden THEN 'shield' ELSE 'free' END,
 CASE WHEN p_hidden THEN 'Escudo' ELSE p_count::text||'d'||p_faces::text END,
 v_eval->'dice',(v_eval->>'total')::integer,v_eval->>'special',p_hidden)
 RETURNING * INTO v_row;
 RETURN to_jsonb(v_row);
END;$fn$;

-- Função colorida reutiliza o cálculo verificado, sem avaliar um dado duas vezes.
CREATE OR REPLACE FUNCTION public.ae_roll_free_colored(
 p_count integer,p_faces integer,p_hidden boolean DEFAULT false,p_colors jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_result jsonb;v_id bigint;v_colors jsonb:='[]'::jsonb;v_color text;v_i integer;
BEGIN
 v_result=public.ae_roll_free(p_count,p_faces,p_hidden);
 v_id=(v_result->>'id')::bigint;
 IF jsonb_typeof(p_colors)='array' AND jsonb_array_length(p_colors)=p_count
    AND p_count BETWEEN 1 AND 12 THEN
  FOR v_i IN 0..p_count-1 LOOP
   v_color=p_colors->>v_i;
   IF v_color IS NULL OR v_color !~ '^#[0-9A-Fa-f]{6}$' THEN
    v_color='#4CC9F0';
   END IF;
   v_colors=v_colors||jsonb_build_array(v_color);
  END LOOP;
 ELSE
  FOR v_i IN 1..coalesce(p_count,0) LOOP
   v_colors=v_colors||jsonb_build_array('#4CC9F0');
  END LOOP;
 END IF;
 UPDATE public.ae_rolls SET colors=v_colors WHERE id=v_id;
 RETURN v_result||jsonb_build_object('colors',v_colors);
END;$fn$;
