// components/ECHLBoxScoreTable.jsx
// ECHL box score table: the shared HockeyTechBoxScoreTable with the ECHL
// league object (utils/hockeyTechLeagues.js).
import HockeyTechBoxScoreTable from './hockeytech/HockeyTechBoxScoreTable';
import { ECHL } from '../utils/hockeyTechLeagues';

export default function ECHLBoxScoreTable(props) {
  return <HockeyTechBoxScoreTable league={ECHL} {...props} />;
}
