alter table questions
add column if not exists question_format text default 'objective';

update questions
set question_format = 'objective'
where question_format is null;

alter table questions
alter column question_format set not null;

alter table questions
drop constraint if exists questions_question_format_check;

alter table questions
add constraint questions_question_format_check
check (question_format in ('objective', 'subjective'));
