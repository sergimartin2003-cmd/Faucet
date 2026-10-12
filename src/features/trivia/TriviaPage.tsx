import { Sparkles } from 'lucide-react'
import { Alert, Badge, Card, EmptyState, PageHeader, Skeleton } from '../../ui'
import { useToast } from '../../ui/toastContext'
import { earnErrorMessage, useAnswerTrivia, useDailyTrivia } from '../../lib/queries'
import { EmailNotice, LoadError } from '../earn/EarnNotice'
import '../earn/earn.css'

export default function TriviaPage() {
  const trivia = useDailyTrivia()
  const answer = useAnswerTrivia()
  const toast = useToast()

  const pick = (questionId: number, index: number) => answer.mutate({ questionId, answer: index }, {
    onSuccess: (result) => toast(result.correct ? `¡Correcto! +${result.reward} puntos` : 'Respuesta incorrecta. Mañana habrá nuevas preguntas.', result.correct ? 'success' : 'info'),
    onError: (error) => toast(earnErrorMessage(error), 'error'),
  })

  const questions = trivia.data ?? []
  const answered = questions.filter((question) => question.answered).length
  const hits = questions.filter((question) => question.correct).length

  return <>
    <PageHeader title="Trivia diaria" description="Tres preguntas nuevas cada día (UTC), iguales para todo el mundo. Cada acierto suma 4 puntos y solo puedes responder una vez." />
    <EmailNotice />
    {questions.length > 0 && <Alert tone={answered === questions.length ? 'success' : 'info'}>{answered === questions.length ? `Has terminado: ${hits} de ${questions.length} aciertos. Vuelve mañana.` : `Llevas ${answered} de ${questions.length} preguntas.`}</Alert>}
    {trivia.isError && <LoadError error={trivia.error} />}
    {trivia.isLoading
      ? <div className="stack"><Skeleton height={220} /><Skeleton height={220} /></div>
      : trivia.data && questions.length === 0
        ? <EmptyState icon={<Sparkles size={22} />} title="Hoy no hay trivia" description="Vuelve mañana." />
        : <div className="stack">
          {questions.map((question, number) => <Card key={question.id}>
            <div className="quiz">
              <div className="quiz-top"><span>Pregunta {number + 1}</span>{question.answered && <Badge tone={question.correct ? 'success' : 'danger'}>{question.correct ? 'Acertada' : 'Fallada'}</Badge>}</div>
              <h2 className="quiz-prompt">{question.prompt}</h2>
              <div className="quiz-options">
                {question.options.map((option, index) => {
                  const state = question.answered
                    ? index === question.correct_index ? ' is-correct' : index === question.your_answer ? ' is-wrong' : ''
                    : ''
                  return <button key={option} type="button" className={`quiz-option${state}`} disabled={question.answered || answer.isPending} onClick={() => pick(question.id, index)}>
                    <span className="key">{String.fromCharCode(65 + index)}</span>{option}
                  </button>
                })}
              </div>
              {question.answered && question.explanation && <p className="quiz-explain">{question.explanation}</p>}
            </div>
          </Card>)}
        </div>}
  </>
}
